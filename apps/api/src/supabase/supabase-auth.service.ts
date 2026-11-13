import { Inject, Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from '../common/session-user';
import { ENV, type Env } from '../config/env';

/** O que lemos de um utilizador do Supabase Auth. O papel e a empresa vêm do `app_metadata`. */
export interface SupabaseUserLike {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
}

/**
 * Converte um utilizador do Supabase na sessão da aplicação. O papel e a empresa estão no `app_metadata`
 * (definidos pelo backend, nunca pelo cliente). Sem email ou sem papel, não há sessão válida.
 */
export function mapSupabaseUser(user: SupabaseUserLike): SessionUser | null {
  const meta = user.app_metadata ?? {};
  const role = typeof meta.role === 'string' ? meta.role : null;
  if (!user.email || !role) return null;
  const companyId = typeof meta.company_id === 'string' ? meta.company_id : null;
  return { id: user.id, email: user.email, role, companyId };
}

export interface SignInResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** Ponte para o Supabase Auth (CLAUDE.md, regra 1): o login é feito pelo backend, não pelo cliente. */
@Injectable()
export class SupabaseAuthService {
  private readonly client: SupabaseClient | null;

  constructor(@Inject(ENV) env: Env) {
    this.client =
      env.SUPABASE_URL && env.SUPABASE_ANON_KEY
        ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  /** `true` quando o Supabase está configurado (há URL e chave). */
  get configured(): boolean {
    return this.client !== null;
  }

  /** Valida um access token e devolve o utilizador da sessão, ou `null`. */
  async getUser(accessToken: string): Promise<SessionUser | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return mapSupabaseUser(data.user);
  }

  /** Autentica por email e palavra-passe; devolve os tokens e o utilizador, ou `null` se falhar. */
  async signIn(email: string, password: string): Promise<SignInResult | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) return null;
    const user = mapSupabaseUser(data.user);
    if (!user) return null;
    return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, user };
  }
}
