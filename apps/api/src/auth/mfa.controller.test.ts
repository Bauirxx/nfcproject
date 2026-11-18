import { ConflictException, ForbiddenException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { mfaConfirmResponseSchema, mfaVerifyResponseSchema } from '@nfc-business/shared/schemas';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionService } from '../common/session.service';
import type { AuthIdentity, ResolvedSession, SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import type { SignInResult, SupabaseAuthService } from '../supabase/supabase-auth.service';
import { MFA_ATTEMPTS_PER_MINUTE, MfaController } from './mfa.controller';

const env = loadEnv({ NODE_ENV: 'development' });
const COOKIES = 'nfc_access=acesso; nfc_refresh=renovacao';

const admin: SessionUser = {
  id: 'u1',
  name: 'Arsénio',
  email: 'a@exemplo.test',
  role: 'platform_admin',
  companyId: null,
  companyName: null,
  mfaEnabled: false,
  mfaRequired: true,
};
const identity: AuthIdentity = { id: 'u1', name: 'Arsénio', email: 'a@exemplo.test', role: 'platform_admin', companyId: null, mfaEnabled: true };
const verified: SignInResult = { accessToken: 'novo.acesso', refreshToken: 'nova', identity };

function setup(options: { supabase?: Partial<Record<keyof SupabaseAuthService, unknown>>; resolved?: ResolvedSession | null } = {}) {
  const supabase = {
    enrollTotp: vi.fn(async () => ({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/NFC?secret=X' })),
    verifyTotp: vi.fn(async () => verified),
    unenrollTotp: vi.fn(async () => true),
    checkPassword: vi.fn(async () => true),
    ...options.supabase,
  } as unknown as SupabaseAuthService;
  const enabledUser = { ...admin, mfaEnabled: true };
  const sessions = {
    accessToken: (req: Request) => (String(req.headers.cookie ?? '').includes('nfc_access=') ? 'acesso' : null),
    resolve: vi.fn(async () => (options.resolved === undefined ? null : options.resolved)),
    toSession: vi.fn(async () => ({ user: enabledUser, aal: 'aal2', mfaPending: false, mfaSetupRequired: false })),
  } as unknown as SessionService;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const controller = new MfaController(supabase, sessions, audit, env);
  return { controller, supabase, sessions, audit, enabledUser };
}

const authed = (user: SessionUser | undefined, ip = '1.1.1.1') =>
  ({ user, ip, headers: { cookie: COOKIES } }) as unknown as AuthedRequest;
const res = () => ({ cookie: vi.fn(), setHeader: vi.fn() }) as unknown as Response;

describe('MfaController', () => {
  it('setup devolve o segredo; recusa quem já tem MFA', async () => {
    const { controller } = setup();
    await expect(controller.setup(authed(admin))).resolves.toMatchObject({ otpauthUrl: expect.stringMatching(/^otpauth:/) });
    await expect(controller.setup(authed({ ...admin, mfaEnabled: true }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirm ativa o MFA, grava os cookies novos (aal2), audita e devolve o utilizador no contrato', async () => {
    const { controller, audit, supabase } = setup();
    const response = res();
    const result = await controller.confirm({ code: '123456' }, authed(admin), response);
    expect(supabase.verifyTotp).toHaveBeenCalledWith({ accessToken: 'acesso', refreshToken: 'renovacao' }, '123456', 'pending');
    expect(response.cookie).toHaveBeenCalledWith('nfc_access', 'novo.acesso', expect.objectContaining({ httpOnly: true }));
    expect(mfaConfirmResponseSchema.safeParse(result).success).toBe(true);
    expect(result.user.mfaEnabled).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.mfa_enabled' }));
  });

  it('confirm com código errado: 422 invalid_code', async () => {
    const { controller } = setup({ supabase: { verifyTotp: vi.fn(async () => null) } });
    await expect(controller.confirm({ code: '000000' }, authed(admin), res())).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('verify exige um login a meio com MFA ativo', async () => {
    const { controller } = setup({ resolved: null });
    await expect(controller.verify({ code: '123456' }, authed(undefined), res())).rejects.toMatchObject({
      response: { error: { code: 'mfa_challenge_expired' } },
    });
  });

  it('verify conclui o login com o código certo e regista a falha com o errado', async () => {
    const pending: ResolvedSession = { user: { ...admin, mfaEnabled: true }, aal: 'aal1', mfaPending: true, mfaSetupRequired: false };
    const ok = setup({ resolved: pending });
    const result = await ok.controller.verify({ code: '123456' }, authed(undefined), res());
    expect(mfaVerifyResponseSchema.safeParse(result).success).toBe(true);

    const bad = setup({ resolved: pending, supabase: { verifyTotp: vi.fn(async () => null) } });
    await expect(bad.controller.verify({ code: '000000' }, authed(undefined), res())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bad.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
  });

  it(`limita a ${MFA_ATTEMPTS_PER_MINUTE} códigos por minuto por utilizador`, async () => {
    const { controller } = setup({ supabase: { verifyTotp: vi.fn(async () => null) } });
    for (let i = 0; i < MFA_ATTEMPTS_PER_MINUTE; i += 1) {
      await expect(controller.confirm({ code: '000000' }, authed(admin, `10.0.0.${i}`), res())).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    }
    await expect(controller.confirm({ code: '000000' }, authed(admin, '10.0.0.99'), res())).rejects.toMatchObject({ status: 429 });
  });

  it('disable: administradores não podem; utilizadores comuns confirmam a palavra-passe', async () => {
    const { controller } = setup();
    await expect(controller.disable({ password: 'x' }, authed(admin), res())).rejects.toBeInstanceOf(ForbiddenException);

    const owner: SessionUser = { ...admin, role: 'profile_owner', mfaRequired: false, mfaEnabled: true };
    await expect(controller.disable({ password: 'certa' }, authed(owner), res())).resolves.toBeUndefined();

    const wrong = setup({ supabase: { checkPassword: vi.fn(async () => false) } });
    await expect(wrong.controller.disable({ password: 'errada' }, authed(owner), res())).rejects.toMatchObject({
      response: { error: { code: 'invalid_current_password' } },
    });
  });
});
