// Uploads de imagens (CLAUDE.md, regra 8; ADR-0018): pedido, receção com validação por magic bytes, quarentena,
// processamento isolado, publicação com nome gerado pelo sistema e consumo único pelo recurso de destino.
import { randomUUID } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LIMITS, type UploadMimeType, type UploadPurpose } from '@nfc-business/shared/constants';
import { detectImageType } from '@nfc-business/shared/images';
import { dbContextOf } from '../common/access';
import type { SessionUser } from '../common/session-user';
import { ENV, type Env } from '../config/env';
import { DatabaseService, type Queryable } from '../database/database.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { ImageProcessorService } from './image-processor.service';

export const QUARANTINE_BUCKET = 'uploads-quarantine';
export const PUBLIC_BUCKET = 'public-images';

interface UploadRow {
  id: string;
  user_id: string;
  purpose: UploadPurpose;
  content_type: UploadMimeType;
  size: number;
  status: 'pending' | 'ready' | 'consumed';
  public_path: string | null;
  expired: boolean;
}

const invalidFile = () => new UnprocessableEntityException({ error: { code: 'invalid_file' } });

/**
 * Validação dos bytes recebidos contra o pedido: tamanho exato e até 2 MB, tipo confirmado pelos primeiros bytes
 * (JPEG, PNG ou WebP; SVG e tudo o resto são recusados) e igual ao declarado. Devolve o código de erro ou `null`.
 */
export function checkUploadBytes(
  bytes: Uint8Array,
  declared: { size: number; contentType: UploadMimeType },
  headerType: string | undefined,
): { status: number; code: string } | null {
  if (bytes.length > LIMITS.uploadMaxBytes) return { status: 413, code: 'file_too_large' };
  if (bytes.length !== declared.size) return { status: 422, code: 'invalid_file' };
  const detected = detectImageType(bytes);
  if (detected === null || detected !== declared.contentType || !(headerType ?? '').startsWith(declared.contentType)) {
    return { status: 415, code: 'unsupported_file_type' };
  }
  return null;
}

@Injectable()
export class UploadsService {
  private readonly publicBase: string | null;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SupabaseAdminService) private readonly admin: SupabaseAdminService,
    @Inject(ImageProcessorService) private readonly images: ImageProcessorService,
    @Inject(ENV) env: Env,
  ) {
    this.publicBase = env.SUPABASE_URL ? `${env.SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/` : null;
  }

  /** Regista o pedido (válido 15 minutos) e devolve o identificador gerado pelo sistema. */
  async sign(user: SessionUser, purpose: UploadPurpose, contentType: UploadMimeType, size: number): Promise<string> {
    if (!this.admin.configured) throw new HttpException({ error: { code: 'uploads_unavailable' } }, HttpStatus.SERVICE_UNAVAILABLE);
    return this.database.withContext(dbContextOf(user), async (db) => {
      const result = await db.query<{ id: string }>(
        `insert into app.uploads (company_id, user_id, purpose, content_type, size) values ($1, $2, $3, $4, $5) returning id`,
        [user.companyId, user.id, purpose, contentType, size],
      );
      return result.rows[0]!.id;
    });
  }

  /**
   * Recebe o ficheiro do pedido `fileId` (só o próprio utilizador, uma vez, dentro da validade). O original vai
   * para a quarentena; a versão re-codificada (WebP sem metadados) vai para o bucket público; o original é apagado.
   */
  async receive(user: SessionUser, fileId: string, bytes: Uint8Array, headerType: string | undefined): Promise<void> {
    const upload = await this.database.withContext(dbContextOf(user), (db) => this.own(db, user, fileId));
    if (upload.status !== 'pending' || upload.expired) throw new NotFoundException({ error: { code: 'not_found' } });
    const problem = checkUploadBytes(bytes, { size: upload.size, contentType: upload.content_type }, headerType);
    if (problem) throw new HttpException({ error: { code: problem.code } }, problem.status);

    const quarantinePath = `${upload.id}`;
    await this.admin.putObject(QUARANTINE_BUCKET, quarantinePath, bytes, upload.content_type);
    try {
      const processed = await this.images.process(bytes, upload.purpose);
      const publicPath = `${upload.purpose}/${randomUUID()}.webp`;
      await this.admin.putObject(PUBLIC_BUCKET, publicPath, processed, 'image/webp');
      await this.database.withContext(dbContextOf(user), (db) =>
        db.query(`update app.uploads set status = 'ready', public_path = $2 where id = $1 and status = 'pending'`, [
          upload.id,
          publicPath,
        ]),
      );
    } finally {
      await this.admin.removeObjects(QUARANTINE_BUCKET, [quarantinePath]);
    }
  }

  /**
   * Consome um upload pronto, do próprio utilizador e para o fim indicado, dentro da transação do chamador.
   * Qualquer outro caso (desconhecido, de outro utilizador ou fim, ainda por receber ou já usado) dá 422.
   */
  async consume(db: Queryable, user: SessionUser, fileId: string, purpose: UploadPurpose): Promise<string> {
    const result = await db.query<{ public_path: string }>(
      `update app.uploads set status = 'consumed'
        where id = $1 and user_id = $2 and purpose = $3 and status = 'ready'
        returning public_path`,
      [fileId, user.id, purpose],
    );
    const path = result.rows[0]?.public_path;
    if (!path || !this.publicBase) throw invalidFile();
    return `${this.publicBase}${path}`;
  }

  private async own(db: Queryable, user: SessionUser, fileId: string): Promise<UploadRow> {
    const result = await db.query<UploadRow>(
      `select id, user_id::text as user_id, purpose, content_type, size, status, public_path, expires_at < now() as expired
         from app.uploads where id = $1 and user_id = $2 for update`,
      [fileId, user.id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: { code: 'not_found' } });
    return row;
  }
}
