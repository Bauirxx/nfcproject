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

  constructor(@Inject(ENV) private readonly env: Env) {
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

  /**
   * Renova a sessão com o refresh token (rotação do Supabase: o anterior deixa de valer). Mantém o nível de
   * garantia (aal) da sessão original. Devolve `null` se o refresh token for inválido, expirado ou revogado.
   */
  async refresh(refreshToken: string): Promise<SignInResult | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) return null;
    const identity = mapSupabaseUser(data.user);
    if (!identity) return null;
    return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, identity };
  }

  /** Revoga a sessão atual no Supabase (logout): o refresh token deixa de servir. Falhas são ignoradas. */
  async revoke(tokens: SessionTokens): Promise<void> {
    try {
      const session = await this.userClient(tokens);
      await session?.client.auth.signOut({ scope: 'local' });
    } catch {
      // Os cookies são apagados na mesma; o access token expira sozinho.
    }
  }

  /** Cliente isolado, sem sessão, para fluxos de uso único (recuperação). */
  private isolatedClient(): SupabaseClient | null {
    if (!this.env.SUPABASE_URL || !this.env.SUPABASE_ANON_KEY) return null;
    return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Pede ao Supabase o email de recuperação. O modelo de email do Supabase aponta para
   * `<redirectTo>?token={{ .TokenHash }}` (docs/deploy.md). Erros são ignorados: a resposta é sempre a mesma.
   */
  async sendRecovery(email: string, redirectTo: string | null): Promise<void> {
    const client = this.isolatedClient();
    if (!client) return;
    try {
      await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    } catch {
      // Mensagem genérica: nunca revela se a conta existe nem se o envio falhou.
    }
  }

  /**
   * Conclui a recuperação: valida o token de uso único (o Supabase consome-o e aplica a validade de 1 hora),
   * muda a palavra-passe e termina todas as sessões (regra 1). Devolve a identidade, ou `null` se o token for
   * inválido, expirado ou já usado.
   */
  async resetPassword(tokenHash: string, password: string): Promise<AuthIdentity | null> {
    const client = this.isolatedClient();
    if (!client) return null;
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error || !data.session || !data.user) return null;
    const updated = await client.auth.updateUser({ password });
    if (updated.error) return null;
    await client.auth.signOut({ scope: 'global' });
    return mapSupabaseUser(data.user);
  }

  /** Muda o nome (user_metadata.name) do próprio utilizador. */
  async updateName(tokens: SessionTokens, name: string): Promise<boolean> {
    const session = await this.userClient(tokens);
    if (!session) return false;
    const { error } = await session.client.auth.updateUser({ data: { name } });
    return !error;
  }

  /** Muda a palavra-passe do próprio utilizador (a atual já foi confirmada por `checkPassword`). */
  async updatePassword(tokens: SessionTokens, password: string): Promise<boolean> {
    const session = await this.userClient(tokens);
    if (!session) return false;
    const { error } = await session.client.auth.updateUser({ password });
    return !error;
  }

  /** Revoga todas as sessões do utilizador, incluindo a atual (refresh tokens deixam de servir). */
  async revokeAll(tokens: SessionTokens): Promise<boolean> {
    const session = await this.userClient(tokens);
    if (!session) return false;
    const { error } = await session.client.auth.signOut({ scope: 'global' });
    return !error;
  }

  // MFA (TOTP) do Supabase, sempre no contexto da sessão do próprio utilizador (nunca com service_role).

  /** Cliente isolado com a sessão do utilizador (tokens dos cookies). Pode renovar os tokens. */
  private async userClient(tokens: SessionTokens): Promise<{ client: SupabaseClient; tokens: SessionTokens } | null> {
    if (!this.env.SUPABASE_URL || !this.env.SUPABASE_ANON_KEY) return null;
    const client = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    if (error || !data.session) return null;
    return {
      client,
      tokens: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
    };
  }

  /**
   * Inicia a configuração do TOTP: remove fatores TOTP por confirmar (tentativas anteriores) e cria um novo.
   * Devolve o segredo e o URI otpauth para a app de autenticação.
   */
  async enrollTotp(tokens: SessionTokens): Promise<{ secret: string; otpauthUrl: string } | null> {
    const session = await this.userClient(tokens);
    if (!session) return null;
    const { client } = session;
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return null;
    for (const factor of factors.data.all) {
      if (factor.factor_type === 'totp' && factor.status !== 'verified') {
        await client.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `NFC Business ${Date.now()}`,
    });
    if (error || data.type !== 'totp') return null;
    return { secret: data.totp.secret, otpauthUrl: data.totp.uri };
  }

  /**
   * Verifica um código TOTP. `pending` confirma o fator por verificar (configuração); `verified` faz o segundo
   * passo do login. Em sucesso, a sessão sobe a aal2 e devolve os tokens novos e a identidade atualizada.
   */
  async verifyTotp(
    tokens: SessionTokens,
    code: string,
    which: 'pending' | 'verified',
  ): Promise<SignInResult | null> {
    const session = await this.userClient(tokens);
    if (!session) return null;
    const { client } = session;
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return null;
    const factor = factors.data.all.find(
      (candidate) =>
        candidate.factor_type === 'totp' &&
        (which === 'verified' ? candidate.status === 'verified' : candidate.status !== 'verified'),
    );
    if (!factor) return null;
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error || !data) return null;
    const user = await client.auth.getUser(data.access_token);
    const identity = user.data.user ? mapSupabaseUser(user.data.user) : null;
    if (!identity) return null;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, identity };
  }

  /** Remove o fator TOTP verificado (exige uma sessão aal2, que o Supabase confirma). */
  async unenrollTotp(tokens: SessionTokens): Promise<boolean> {
    const session = await this.userClient(tokens);
    if (!session) return false;
    const { client } = session;
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return false;
    for (const factor of factors.data.all) {
      if (factor.factor_type !== 'totp') continue;
      const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (error) return false;
    }
    return true;
  }

  /** Confirma a palavra-passe num cliente à parte, sem tocar na sessão atual (desativar o MFA). */
  async checkPassword(email: string, password: string): Promise<boolean> {
    if (!this.env.SUPABASE_URL || !this.env.SUPABASE_ANON_KEY) return false;
    const client = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) await client.auth.signOut({ scope: 'local' });
    return !error;
  }
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}
