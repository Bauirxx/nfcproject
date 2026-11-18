import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from './auth.guard';
import { ALLOW_WITHOUT_MFA_KEY } from './mfa.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { ResolvedSession, SessionService } from './session.service';

function makeContext(request: Record<string, unknown> = {}): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

const reflectorWith = (flags: { isPublic?: boolean; allowWithoutMfa?: boolean } = {}): Reflector =>
  ({
    getAllAndOverride: (key: string) =>
      key === IS_PUBLIC_KEY ? Boolean(flags.isPublic) : key === ALLOW_WITHOUT_MFA_KEY ? Boolean(flags.allowWithoutMfa) : false,
  }) as unknown as Reflector;

const sessionsWith = (session: ResolvedSession | null): SessionService =>
  ({ resolve: async () => session }) as unknown as SessionService;

function session(overrides: Partial<ResolvedSession> = {}): ResolvedSession {
  return {
    user: {
      id: 'u1',
      name: 'Edu',
      email: 'a@b.test',
      role: 'company_editor',
      companyId: 'c1',
      companyName: 'ACME',
      mfaEnabled: false,
      mfaRequired: false,
    },
    aal: 'aal1',
    mfaPending: false,
    mfaSetupRequired: false,
    ...overrides,
  };
}

describe('AuthGuard', () => {
  it('deixa passar rotas públicas sem sessão', async () => {
    const guard = new AuthGuard(reflectorWith({ isPublic: true }), sessionsWith(null));
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('recusa rotas protegidas sem sessão', async () => {
    const guard = new AuthGuard(reflectorWith(), sessionsWith(null));
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deixa passar com sessão e anexa o utilizador ao pedido', async () => {
    const request: Record<string, unknown> = {};
    const current = session();
    const guard = new AuthGuard(reflectorWith(), sessionsWith(current));
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user).toEqual(current.user);
  });

  it('segundo fator por verificar: 401 (não é uma sessão)', async () => {
    const guard = new AuthGuard(reflectorWith(), sessionsWith(session({ mfaPending: true })));
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('administrador sem MFA: 403 mfa_setup_required, exceto nas rotas de configuração', async () => {
    const pending = session({ mfaSetupRequired: true });
    const blocked = new AuthGuard(reflectorWith(), sessionsWith(pending));
    await expect(blocked.canActivate(makeContext())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(blocked.canActivate(makeContext())).rejects.toMatchObject({
      response: { error: { code: 'mfa_setup_required' } },
    });

    const setupRoute = new AuthGuard(reflectorWith({ allowWithoutMfa: true }), sessionsWith(pending));
    await expect(setupRoute.canActivate(makeContext())).resolves.toBe(true);
  });
});
