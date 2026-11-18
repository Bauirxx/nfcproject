import { BadRequestException, Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { auditQuerySchema, type AuditEntry, type AuditPage } from '@nfc-business/shared/schemas';
import type { z } from 'zod';
import { dbContextOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService } from '../database/database.service';
import { REPORT_TIME_ZONE } from '../analytics/analytics.service';

type AuditQuery = z.output<typeof auditQuerySchema>;

interface AuditRow {
  id: string;
  action: AuditEntry['action'];
  actor_name: string;
  actor_email: string;
  target: string | null;
  company_name: string | null;
  created_at: Date;
  total: number;
}

/** Escapa `%`, `_` e `\` para uma pesquisa literal com `ilike`. */
export function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Auditoria (regra 11): só leitura. platform_admin vê tudo; company_admin vê a sua empresa (RLS pelo contexto
 * da sessão). Filtros por ação, autor e datas civis no fuso dos relatórios.
 */
@Controller('audit')
export class AuditController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
    @Req() req: AuthedRequest,
  ): Promise<AuditPage> {
    const user = requirePermission(req, 'audit.view');
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException({ error: { code: 'invalid_request' } });
    }
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.database.withContext(dbContextOf(user), async (db) => {
      const result = await db.query<AuditRow>(
        `select a.id, a.action, a.actor_name, a.actor_email, a.target, c.name as company_name, a.created_at,
                count(*) over ()::int as total
           from app.audit_logs a
           left join app.companies c on c.id = a.company_id
          where ($1::text is null or a.action = $1)
            and ($2::text is null or a.actor_name ilike $2 or a.actor_email ilike $2)
            and ($3::date is null or (a.created_at at time zone $5)::date >= $3::date)
            and ($4::date is null or (a.created_at at time zone $5)::date <= $4::date)
          order by a.created_at desc, a.id
          limit $6 offset $7`,
        [
          query.action ?? null,
          query.actor ? likePattern(query.actor) : null,
          query.from ?? null,
          query.to ?? null,
          REPORT_TIME_ZONE,
          query.pageSize,
          offset,
        ],
      );
      return result.rows;
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorName: row.actor_name,
        actorEmail: row.actor_email,
        target: row.target,
        companyName: row.company_name,
        createdAt: row.created_at.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: rows[0]?.total ?? (offset > 0 ? await this.count(user, query) : 0),
    };
  }

  /** Total quando a página pedida está para lá do fim (sem linhas para ler o `count(*) over ()`). */
  private count(user: AuthedRequest['user'] & object, query: AuditQuery): Promise<number> {
    return this.database.withContext(dbContextOf(user), async (db) => {
      const result = await db.query<{ n: number }>(
        `select count(*)::int as n from app.audit_logs a
          where ($1::text is null or a.action = $1)
            and ($2::text is null or a.actor_name ilike $2 or a.actor_email ilike $2)
            and ($3::date is null or (a.created_at at time zone $5)::date >= $3::date)
            and ($4::date is null or (a.created_at at time zone $5)::date <= $4::date)`,
        [query.action ?? null, query.actor ? likePattern(query.actor) : null, query.from ?? null, query.to ?? null, REPORT_TIME_ZONE],
      );
      return result.rows[0]?.n ?? 0;
    });
  }
}
