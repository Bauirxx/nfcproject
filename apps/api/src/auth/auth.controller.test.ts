import { UnauthorizedException } from '@nestjs/common';
import { loginResponseSchema, sessionResponseSchema } from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import { CsrfService } from '../common/csrf';
import type { DatabaseService } from '../database/database.service';
import type { SessionService, SessionUser } from '../common/session.service';
import type { AuthIdentity, ResolvedSession } from '../common/session-user';
import { loadEnv } from '../config/env';
import type { SignInResult, SupabaseAuthService } from '../supabase/supabase-auth.service';
import { AuthController } from './auth.controller';

const breached = vi.hoisted(() => ({ value: false }));
vi.mock('../common/breached-password', () => ({ isBreachedPassword: vi.fn(async () => breached.value) }));

const env = loadEnv({ NODE_ENV: 'development', IP_HASH_SECRET: 's'.repeat(32) });
const identity: AuthIdentity = {
  id: 'u1',
  email: 'arsenio@exemplo.test',
  name: 'Arsénio',
  role: 'platform_admin',
  companyId: null,
  mfaEnabled: false,
};
const user: SessionUser = {
  id: 'u1',
  name: 'Arsénio',
  email: 'arsenio@exemplo.test',
  role: 'platform_admin',
  companyId: null,
  companyName: null,
  mfaEnabled: false,
  mfaRequired: true,
};

const req = (ip = '197.218.1.10') => ({ ip, headers: {} }) as unknown as Request;

function fakeRes() {
  return { cookie: vi.fn(), clearCookie: vi.fn(), setHeader: vi.fn() } as unknown as Response;
}

function controllerWith(options: {
  signIn?: () => Promise<SignInResult | null>;
  toSession?: () => Promise<ResolvedSession>;
  getUser?: () => Promise<SessionUser | null>;
  refresh?: () => Promise<SignInResult | null>;
  resetPassword?: () => Promise<AuthIdentity | null>;
}) {
  const supabase = {
    sendRecovery: vi.fn(async () => undefined),
    resetPassword: vi.fn(options.resetPassword ?? (async () => null)),
    signIn: options.signIn ?? (async () => null),
    refresh: vi.fn(options.refresh ?? (async () => null)),
    revoke: vi.fn(async () => undefined),
  } as unknown as SupabaseAuthService;
  const sessions = {
    accessToken: (r: Request) => (String(r.headers.cookie ?? '').match(/nfc_access=([^;]+)/)?.[1] ?? null),
    getUser: options.getUser ?? (async () => null),
    toSession:
      options.toSession ??
      (async () => ({ user, aal: 'aal1', mfaPending: false, mfaSetupRequired: true }) satisfies ResolvedSession),
  } as unknown as SessionService;
  const csrf = new CsrfService(env);
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  return { controller: new AuthController(supabase, sessions, csrf, audit, { configured: false } as unknown as DatabaseService, env), csrf, audit, supabase };
}

describe('AuthController', () => {
  it('login válido grava os cookies e devolve a sessão no contrato', async () => {
    const { controller } = controllerWith({
      signIn: async () => ({ accessToken: 'a.b.c', refreshToken: 'r', identity }),
    });
    const res = fakeRes();
    const result = await controller.login({ email: 'arsenio@exemplo.test', password: 'x' }, res, req());
    expect(result).toEqual({ status: 'authenticated', user });
    expect(loginResponseSchema.safeParse(result).success).toBe(true);
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  it('com MFA ativo, o login fica a meio: responde mfa_required sem dados do utilizador', async () => {
    const { controller } = controllerWith({
      signIn: async () => ({ accessToken: 'a.b.c', refreshToken: 'r', identity: { ...identity, mfaEnabled: true } }),
      toSession: async () => ({ user: { ...user, mfaEnabled: true }, aal: 'aal1', mfaPending: true, mfaSetupRequired: false }),
    });
    const result = await controller.login({ email: 'arsenio@exemplo.test', password: 'x' }, fakeRes(), req());
    expect(result).toEqual({ status: 'mfa_required' });
  });

  it('login inválido responde 401 invalid_credentials e não grava cookies', async () => {
    const { controller } = controllerWith({ signIn: async () => null });
    const res = fakeRes();
    await expect(controller.login({ email: 'x@y.test', password: 'má' }, res, req())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('regista o login falhado na auditoria só com o email tentado', async () => {
    const { controller, audit } = controllerWith({ signIn: async () => null });
    await expect(controller.login({ email: 'x@y.test', password: 'Segredo#2026' }, fakeRes(), req())).rejects.toThrow();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed', actor: expect.objectContaining({ email: 'x@y.test' }) }),
    );
    expect(JSON.stringify((audit.record as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('Segredo#2026');
  });

  it('limita o login a 5 tentativas por minuto por email (429 com Retry-After)', async () => {
    const { controller } = controllerWith({ signIn: async () => null });
    for (let i = 0; i < 5; i += 1) {
      await expect(controller.login({ email: 'alvo@y.test', password: 'x' }, fakeRes(), req(`10.0.0.${i}`))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    const res = fakeRes();
    await expect(controller.login({ email: 'ALVO@y.test', password: 'x' }, res, req('10.0.0.99'))).rejects.toMatchObject({
      status: 429,
    });
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('logout revoga a sessão no Supabase, regista a saída e limpa os cookies', async () => {
    const { controller, supabase, audit } = controllerWith({ getUser: async () => user });
    const res = fakeRes();
    await controller.logout({ headers: { cookie: 'nfc_access=a.b.c; nfc_refresh=r1' } } as unknown as Request, res);
    expect(supabase.revoke).toHaveBeenCalledWith({ accessToken: 'a.b.c', refreshToken: 'r1' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.logout' }));
    expect(res.clearCookie).toHaveBeenCalledTimes(2);

    const anonymous = controllerWith({});
    const res2 = fakeRes();
    await anonymous.controller.logout({ headers: {} } as unknown as Request, res2);
    expect(anonymous.supabase.revoke).not.toHaveBeenCalled();
    expect(res2.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('refresh renova os cookies com o refresh token; sem ele (ou inválido) dá 401 e limpa os cookies', async () => {
    const ok = controllerWith({ refresh: async () => ({ accessToken: 'novo', refreshToken: 'r2', identity }) });
    const res = fakeRes();
    await ok.controller.refresh({ headers: { cookie: 'nfc_refresh=r1' } } as unknown as Request, res);
    expect(ok.supabase.refresh).toHaveBeenCalledWith('r1');
    expect(res.cookie).toHaveBeenCalledWith('nfc_access', 'novo', expect.objectContaining({ httpOnly: true }));
    expect(res.cookie).toHaveBeenCalledWith('nfc_refresh', 'r2', expect.objectContaining({ path: '/api/auth' }));

    const missing = controllerWith({});
    const res2 = fakeRes();
    await expect(missing.controller.refresh({ headers: {} } as unknown as Request, res2)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(missing.supabase.refresh).not.toHaveBeenCalled();
    expect(res2.clearCookie).toHaveBeenCalledTimes(2);

    const revoked = controllerWith({ refresh: async () => null });
    await expect(
      revoked.controller.refresh({ headers: { cookie: 'nfc_refresh=velho' } } as unknown as Request, fakeRes()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recover responde sempre igual e pede o link com o destino /definir-password', async () => {
    const withOrigin = loadEnv({ NODE_ENV: 'development', IP_HASH_SECRET: 's'.repeat(32), PUBLIC_APP_URL: 'https://app.exemplo.com' });
    const { supabase } = controllerWith({});
    const controller = new AuthController(
      supabase,
      { accessToken: () => null } as unknown as SessionService,
      new CsrfService(withOrigin),
      { record: vi.fn(async () => undefined) } as unknown as AuditService,
      { configured: false } as unknown as DatabaseService,
      withOrigin,
    );
    await expect(controller.recover({ email: 'ninguem@exemplo.test' }, req(), fakeRes())).resolves.toBeUndefined();
    expect(supabase.sendRecovery).toHaveBeenCalledWith('ninguem@exemplo.test', 'https://app.exemplo.com/definir-password');
  });

  it('recover/confirm: vazada não gasta o token; token inválido dá 400; sucesso audita e limpa os cookies', async () => {
    breached.value = true;
    const weak = controllerWith({ resetPassword: async () => identity });
    await expect(
      weak.controller.recoverConfirm({ token: 't'.repeat(40), password: 'password123456' }, req(), fakeRes()),
    ).rejects.toMatchObject({ response: { error: { code: 'weak_password' } } });
    expect(weak.supabase.resetPassword).not.toHaveBeenCalled();
    breached.value = false;

    const invalid = controllerWith({ resetPassword: async () => null });
    await expect(
      invalid.controller.recoverConfirm({ token: 't'.repeat(40), password: 'NovaSegura#2026' }, req(), fakeRes()),
    ).rejects.toMatchObject({ response: { error: { code: 'invalid_token' } } });

    const ok = controllerWith({ resetPassword: async () => identity });
    const res = fakeRes();
    await ok.controller.recoverConfirm({ token: 't'.repeat(40), password: 'NovaSegura#2026' }, req(), res);
    expect(ok.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password_changed' }));
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('sem sessão mas com refresh token, a sessão indica refreshable', async () => {
    const { controller } = controllerWith({});
    const result = await controller.session({ headers: { cookie: 'nfc_refresh=r1' } } as unknown as Request, fakeRes());
    expect(result).toMatchObject({ user: null, refreshable: true });
    expect(sessionResponseSchema.safeParse(result).success).toBe(true);
  });

  it('a sessão devolve o utilizador e o token CSRF no contrato, sem cache', async () => {
    const request = { headers: { cookie: 'nfc_access=tok' } } as unknown as Request;
    const { controller, csrf } = controllerWith({ getUser: async () => user });
    const res = fakeRes();
    const result = await controller.session(request, res);
    expect(result).toEqual({ user, csrfToken: csrf.tokenFor('tok') });
    expect(sessionResponseSchema.safeParse(result).success).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');

    const anonymous = await controllerWith({}).controller.session({ headers: {} } as Request, fakeRes());
    expect(anonymous.user).toBeNull();
    expect(sessionResponseSchema.safeParse(anonymous).success).toBe(true);
  });
});
