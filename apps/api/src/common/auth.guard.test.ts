import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from './auth.guard';
import type { SessionService, SessionUser } from './session.service';

function makeContext(request: Record<string, unknown> = {}): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

const reflectorWith = (isPublic: boolean): Reflector =>
  ({ getAllAndOverride: () => isPublic }) as unknown as Reflector;

const sessionsWith = (user: SessionUser | null): SessionService =>
  ({ getUser: async () => user }) as unknown as SessionService;

const user: SessionUser = { id: 'u1', email: 'a@b.test', role: 'company_admin', companyId: 'c1' };

describe('AuthGuard', () => {
  it('deixa passar rotas públicas sem sessão', async () => {
    const guard = new AuthGuard(reflectorWith(true), sessionsWith(null));
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('recusa rotas protegidas sem sessão', async () => {
    const guard = new AuthGuard(reflectorWith(false), sessionsWith(null));
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deixa passar rotas protegidas com sessão e anexa o utilizador ao pedido', async () => {
    const request: Record<string, unknown> = {};
    const guard = new AuthGuard(reflectorWith(false), sessionsWith(user));
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });
});
