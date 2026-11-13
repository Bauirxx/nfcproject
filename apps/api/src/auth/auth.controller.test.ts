import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { SessionService, SessionUser } from '../common/session.service';
import type { Env } from '../config/env';
import type { SignInResult, SupabaseAuthService } from '../supabase/supabase-auth.service';
import { AuthController } from './auth.controller';

const user: SessionUser = { id: 'u1', email: 'arsenio@exemplo.test', role: 'platform_admin', companyId: null };
const env = { NODE_ENV: 'development', PORT: 3000 } as Env;

function fakeRes() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
}

function controllerWith(options: {
  signIn?: (email: string, password: string) => Promise<SignInResult | null>;
  getUser?: () => Promise<SessionUser | null>;
}) {
  const supabase = { signIn: options.signIn ?? (async () => null) } as unknown as SupabaseAuthService;
  const sessions = { getUser: options.getUser ?? (async () => null) } as unknown as SessionService;
  return new AuthController(supabase, sessions, env);
}

describe('AuthController', () => {
  it('login válido grava os cookies e devolve a sessão', async () => {
    const controller = controllerWith({
      signIn: async () => ({ accessToken: 'a', refreshToken: 'r', user }),
    });
    const res = fakeRes();
    const result = await controller.login({ email: 'arsenio@exemplo.test', password: 'x' }, res);
    expect(result).toEqual({ status: 'authenticated', user });
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  it('login inválido responde 401 invalid_credentials e não grava cookies', async () => {
    const controller = controllerWith({ signIn: async () => null });
    const res = fakeRes();
    await expect(controller.login({ email: 'x@y.test', password: 'má' }, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('logout limpa os cookies', () => {
    const controller = controllerWith({});
    const res = fakeRes();
    controller.logout(res);
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('a sessão devolve o utilizador ou null', async () => {
    const request = { headers: {} } as Request;
    expect(await controllerWith({ getUser: async () => user }).session(request)).toEqual({ user });
    expect(await controllerWith({ getUser: async () => null }).session(request)).toEqual({ user: null });
  });
});
