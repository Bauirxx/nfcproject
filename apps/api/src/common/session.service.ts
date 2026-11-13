import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import type { SessionUser } from './session-user';

export type { SessionUser } from './session-user';

/** Cookie HttpOnly com o access token (CLAUDE.md, regra 1). */
export const ACCESS_TOKEN_COOKIE = 'nfc_access';

/** Lê um cookie do cabeçalho `Cookie` sem depender de middleware de cookies. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

@Injectable()
export class SessionService {
  constructor(@Inject(SupabaseAuthService) private readonly supabaseAuth: SupabaseAuthService) {}

  /** Utilizador da sessão a partir do pedido, ou `null` se não houver sessão válida. */
  async getUser(request: Request): Promise<SessionUser | null> {
    const token = readCookie(request.headers.cookie, ACCESS_TOKEN_COOKIE);
    if (!token) return null;
    return this.supabaseAuth.getUser(token);
  }
}
