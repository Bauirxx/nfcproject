import { Inject, Injectable, Logger } from '@nestjs/common';
import { MFA_REQUIRED_ROLES } from '@nfc-business/shared/constants';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { readAal, SupabaseAuthService } from '../supabase/supabase-auth.service';
import type { AuthAssurance, AuthIdentity, ResolvedSession, SessionUser } from './session-user';

export type { ResolvedSession, SessionUser } from './session-user';

/** Cookie HttpOnly com o access token (CLAUDE.md, regra 1). */
export const ACCESS_TOKEN_COOKIE = 'nfc_access';

/** Lê um cookie do cabeçalho `Cookie` sem depender de middleware de cookies. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger('Session');

  constructor(
    @Inject(SupabaseAuthService) private readonly supabaseAuth: SupabaseAuthService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  /** Access token do cookie do pedido, se existir. */
  accessToken(request: Request): string | null {
    return readCookie(request.headers.cookie, ACCESS_TOKEN_COOKIE);
  }

  /** Sessão completa a partir do cookie, ou `null` se não houver sessão válida no Supabase. */
  async resolve(request: Request): Promise<ResolvedSession | null> {
    const token = this.accessToken(request);
    if (!token) return null;
    const identity = await this.supabaseAuth.getUser(token);
    if (!identity) return null;
    return this.toSession(identity, readAal(token));
  }

  /** Utilizador da sessão para o cliente: `null` sem sessão ou com o segundo fator por verificar. */
  async getUser(request: Request): Promise<SessionUser | null> {
    const session = await this.resolve(request);
    return session && !session.mfaPending ? session.user : null;
  }

  /** Completa a identidade com o nome da empresa e o estado do MFA (contrato `sessionUserSchema`). */
  async toSession(identity: AuthIdentity, aal: AuthAssurance): Promise<ResolvedSession> {
    const mfaRequired = MFA_REQUIRED_ROLES.includes(identity.role);
    const user: SessionUser = {
      id: identity.id,
      name: identity.name,
      email: identity.email,
      role: identity.role,
      companyId: identity.companyId,
      companyName: await this.companyName(identity.companyId),
      mfaEnabled: identity.mfaEnabled,
      mfaRequired,
    };
    return {
      user,
      aal,
      mfaPending: identity.mfaEnabled && aal !== 'aal2',
      mfaSetupRequired: mfaRequired && !identity.mfaEnabled,
    };
  }

  /** Nome da empresa da sessão, lido com o contexto RLS dessa empresa. Sem base de dados ou em erro: `null`. */
  private async companyName(companyId: string | null): Promise<string | null> {
    if (!companyId || !this.database.configured) return null;
    try {
      return await this.database.withContext({ companyId, isPlatformAdmin: false }, async (db) => {
        const result = await db.query<{ name: string }>('select name from app.companies where id = $1', [companyId]);
        return result.rows[0]?.name ?? null;
      });
    } catch (error) {
      this.logger.warn(`Falha a ler o nome da empresa: ${error instanceof Error ? error.message : 'erro'}`);
      return null;
    }
  }
}
