import { UnauthorizedException } from '@nestjs/common';
import { loginResponseSchema, sessionResponseSchema } from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import { CsrfService } from '../common/csrf';
import type { SessionService, SessionUser } from '../common/session.service';
import type { AuthIdentity, ResolvedSession } from '../common/session-user';
import { loadEnv } from '../config/env';
import type { SignInResult, SupabaseAuthService } from '../supabase/supabase-auth.service';
import { AuthController } from './auth.controller';

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
}) {
  const supabase = { signIn: options.signIn ?? (async () => null) } as unknown as SupabaseAuthService;
  const sessions = {
    getUser: options.getUser ?? (async () => null),
    toSession:
      options.toSession ??
      (async () => ({ user, aal: 'aal1', mfaPending: false, mfaSetupRequired: true }) satisfies ResolvedSession),
  } as unknown as SessionService;
  const csrf = new CsrfService(env);
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  return { controller: new AuthController(supabase, sessions, csrf, audit, env), csrf, audit };
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

  it('logout limpa os cookies', () => {
    const { controller } = controllerWith({});
    const res = fakeRes();
    controller.logout(res);
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
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
