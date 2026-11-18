// Registo de auditoria append-only (CLAUDE.md, regra 11): ações críticas, sem passwords nem tokens.
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuditAction } from '@nfc-business/shared/constants';
import { DatabaseService } from '../database/database.service';

export interface AuditActor {
  id: string | null;
  name: string;
  email: string;
  companyId: string | null;
  isPlatformAdmin: boolean;
}

export interface AuditEntryInput {
  action: AuditAction;
  actor: AuditActor;
  target?: string | null;
  /** Só metadados não sensíveis (nunca passwords, tokens ou códigos). */
  metadata?: Record<string, string | number | boolean>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /**
   * Acrescenta uma entrada. Corre no contexto da empresa do autor (RLS). Uma falha na auditoria fica no log,
   * mas não desfaz a ação já feita no Supabase.
   */
  async record(entry: AuditEntryInput): Promise<void> {
    if (!this.database.configured) return;
    try {
      await this.database.withContext(
        { companyId: entry.actor.companyId, isPlatformAdmin: entry.actor.isPlatformAdmin },
        (db) =>
          db.query(
            `insert into app.audit_logs (company_id, actor_user_id, actor_name, actor_email, action, target, metadata)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [
              entry.actor.companyId,
              entry.actor.id,
              entry.actor.name.slice(0, 120),
              entry.actor.email.slice(0, 254),
              entry.action,
              entry.target?.slice(0, 200) ?? null,
              JSON.stringify(entry.metadata ?? {}),
            ],
          ),
      );
    } catch (error) {
      this.logger.error(`Falha a registar ${entry.action}: ${error instanceof Error ? error.message : 'erro'}`);
    }
  }
}
