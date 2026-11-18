import { Inject, Injectable } from '@nestjs/common';
import { LIMITS, ROLES, type Role } from '@nfc-business/shared/constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthAssurance, AuthIdentity } from '../common/session-user';
import { ENV, type Env } from '../config/env';

/** O que lemos de um utilizador do Supabase Auth. O papel e a empresa vêm do `app_metadata`. */
export interface SupabaseUserLike {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  factors?: ReadonlyArray<{ factor_type?: string; status?: string }> | null;
}

const ROLE_SET = new Set<string>(ROLES);

/** Nome a mostrar: o do perfil do utilizador no Supabase ou, na falta dele, a parte local do email. */
function displayName(user: SupabaseUserLike, email: string): string {
  const meta = user.user_metadata ?? {};
  for (const key of ['name', 'full_name']) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim().slice(0, LIMITS.nameMax);
  }
  return email.split('@')[0] ?? email;
}

/**
 * Converte um utilizador do Supabase na identidade da aplicação. O papel e a empresa estão no `app_metadata`
 * (definidos pelo backend, nunca pelo cliente). Sem email ou com um papel desconhecido, não há sessão.
 */
export function mapSupabaseUser(user: SupabaseUserLike): AuthIdentity | null {
  const meta = user.app_metadata ?? {};
  const role = typeof meta.role === 'string' && ROLE_SET.has(meta.role) ? (meta.role as Role) : null;
  if (!user.email || !role) return null;
  const companyId = typeof meta.company_id === 'string' ? meta.company_id : null;
  const mfaEnabled = (user.factors ?? []).some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  );
  return { id: user.id, email: user.email, name: displayName(user, user.email), role, companyId, mfaEnabled };
}

/**
 * Nível de garantia (`aal`) do access token. Só se lê depois de o Supabase ter validado o token (`getUser`);
 * qualquer coisa inesperada conta como `aal1`, o nível mais baixo.
 */
export function readAal(accessToken: string): AuthAssurance {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return 'aal1';
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { aal?: unknown };
    return claims.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

export interface SignInResult {
  accessToken: string;
  refreshToken: string;
  identity: AuthIdentity;
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

  /** Valida um access token no Supabase e devolve a identidade, ou `null`. */
  async getUser(accessToken: string): Promise<AuthIdentity | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return mapSupabaseUser(data.user);
  }

  /** Autentica por email e palavra-passe; devolve os tokens e a identidade, ou `null` se falhar. */
  async signIn(email: string, password: string): Promise<SignInResult | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) return null;
    const identity = mapSupabaseUser(data.user);
    if (!identity) return null;
    return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, identity };
  }
}
