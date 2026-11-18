// Uploads contra o Supabase real (só com DB_INTEGRATION=1 e a chave service_role no `.env`): pedido, receção de
// um JPEG com EXIF, quarentena, processamento, publicação e consumo único. A imagem pública de teste é apagada.
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { ImageProcessorService } from './image-processor.service';
import { PUBLIC_BUCKET, UploadsService } from './uploads.service';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

const platform: SessionUser = {
  id: '00000000-0000-0000-0000-0000000000ee',
  name: 'Teste uploads',
  email: 'uploads@exemplo.test',
  role: 'platform_admin',
  companyId: null,
  companyName: null,
  mfaEnabled: true,
  mfaRequired: true,
};
const other: SessionUser = { ...platform, id: '00000000-0000-0000-0000-0000000000ef' };

describe.runIf(enabled && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY))('Uploads (Supabase real)', () => {
  const env = loadEnv({ ...process.env, NODE_ENV: 'test' });
  const database = new DatabaseService(env);
  const admin = new SupabaseAdminService(env);
  const uploads = new UploadsService(database, admin, new ImageProcessorService(env), env);
  const published: string[] = [];

  afterAll(async () => {
    if (published.length > 0) await admin.removeObjects(PUBLIC_BUCKET, published);
    await database.onModuleDestroy();
  });

  it('publica uma versão WebP sem EXIF e só a deixa consumir uma vez, pelo próprio e para o fim certo', async () => {
    const jpeg = new Uint8Array(
      await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#2255aa' } })
        .jpeg()
        .withExif({ IFD0: { Copyright: 'Segredo do teste' } })
        .toBuffer(),
    );
    const fileId = await uploads.sign(platform, 'company_logo', 'image/jpeg', jpeg.length);

    // Outro utilizador não pode enviar para este pedido.
    await expect(uploads.receive(other, fileId, jpeg, 'image/jpeg')).rejects.toBeInstanceOf(NotFoundException);
    await uploads.receive(platform, fileId, jpeg, 'image/jpeg');
    // O mesmo pedido não aceita um segundo envio.
    await expect(uploads.receive(platform, fileId, jpeg, 'image/jpeg')).rejects.toBeInstanceOf(NotFoundException);

    const ctx = { companyId: null, isPlatformAdmin: true };
    await expect(
      database.withContext(ctx, (db) => uploads.consume(db, platform, fileId, 'profile_photo')),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    const url = await database.withContext(ctx, (db) => uploads.consume(db, platform, fileId, 'company_logo'));
    published.push(url.split(`/${PUBLIC_BUCKET}/`)[1]!);
    expect(url).toMatch(/^https:\/\/.+\/storage\/v1\/object\/public\/public-images\/company_logo\/[0-9a-f-]{36}\.webp$/);
    await expect(
      database.withContext(ctx, (db) => uploads.consume(db, platform, fileId, 'company_logo')),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(512);
    expect(meta.exif).toBeUndefined();
    expect(bytes.includes(Buffer.from('Segredo do teste'))).toBe(false);
  });

  it('recusa um SVG mesmo que o pedido diga PNG', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const fileId = await uploads.sign(platform, 'company_logo', 'image/png', svg.length);
    await expect(uploads.receive(platform, fileId, svg, 'image/png')).rejects.toMatchObject({ status: 415 });
  });
});
