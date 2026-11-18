// Membros das empresas: convites, papéis e remoção (CLAUDE.md, regras 1 e 2; ADR-0017).
// A conta vive no Supabase Auth (papel e empresa no app_metadata) e é espelhada em `app.users` (RLS por empresa).
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MemberRole } from '@nfc-business/shared/constants';
import type { Member } from '@nfc-business/shared/schemas';
import { ENV, type Env } from '../config/env';
import type { Queryable } from '../database/database.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';

export interface MemberRow {
  id: string;
  name: string | null;
  email: string;
  role: MemberRole;
  status: 'active' | 'invited';
  created_at: Date;
}

export const MEMBER_SELECT = `select id::text as id, name, email, role, status, created_at from app.users`;

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger('Members');
  private readonly inviteRedirect: string | null;

  constructor(
    @Inject(SupabaseAdminService) private readonly admin: SupabaseAdminService,
    @Inject(ENV) env: Env,
  ) {
    this.inviteRedirect = env.PUBLIC_APP_URL ? `${env.PUBLIC_APP_URL}/convite` : null;
  }

  /**
   * Convida e espelha em `app.users` (estado `invited`) dentro da transação do chamador. Se a escrita na base de
   * dados falhar depois do convite, a conta criada é removida para não ficar órfã.
   */
  async invite(db: Queryable, email: string, role: MemberRole, companyId: string): Promise<Member> {
    const normalized = email.trim().toLowerCase();
    const result = await this.admin.invite(normalized, role, companyId, this.inviteRedirect);
    if (result.status === 'already_exists') throw new ConflictException({ error: { code: 'already_member' } });
    try {
      const inserted = await db.query<MemberRow>(
        `insert into app.users (id, email, role, company_id, status) values ($1, $2, $3, $4, 'invited')
         returning id::text as id, name, email, role, status, created_at`,
        [result.userId, normalized, role, companyId],
      );
      return toMember(inserted.rows[0]!);
    } catch (error) {
      this.logger.error(`Falha a espelhar o convite; a remover a conta criada: ${error instanceof Error ? error.message : 'erro'}`);
      await this.admin.deleteUser(result.userId).catch(() => undefined);
      throw error;
    }
  }

  /** Membro da empresa da sessão; qualquer outro utilizador dá 404 (regra 2). */
  async memberOr404(db: Queryable, companyId: string, id: string): Promise<MemberRow> {
    const result = await db.query<MemberRow>(`${MEMBER_SELECT} where id::text = $1 and company_id = $2 for update`, [
      id,
      companyId,
    ]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: { code: 'not_found' } });
    return row;
  }
}
