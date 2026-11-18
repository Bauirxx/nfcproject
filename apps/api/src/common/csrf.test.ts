import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import type { Reflector } from '@nestjs/core';
import { loadEnv } from '../config/env';
import { CsrfGuard, CsrfService } from './csrf';

const ORIGIN = 'https://app.exemplo.com';

function request(method: string, headers: Record<string, string> = {}): Request {
  return { method, headers } as unknown as Request;
}

function context(req: Request): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

const reflector = (skip = false) => ({ getAllAndOverride: () => skip }) as unknown as Reflector;

function setup(publicUrl?: string) {
  const service = new CsrfService(loadEnv({ IP_HASH_SECRET: 's'.repeat(32), PUBLIC_APP_URL: publicUrl }));
  return { service, guard: new CsrfGuard(service, reflector()) };
}

describe('CsrfService', () => {
  it('o token depende da sessão e do segredo', () => {
    const { service } = setup();
    expect(service.tokenFor('sessao-a')).not.toBe(service.tokenFor('sessao-b'));
    expect(service.tokenFor(null)).toBe(service.tokenFor(null));
    const other = new CsrfService(loadEnv({ IP_HASH_SECRET: 't'.repeat(32) }));
    expect(other.tokenFor('sessao-a')).not.toBe(service.tokenFor('sessao-a'));
  });
});

describe('CsrfGuard', () => {
  it('não exige nada em GET', () => {
    const { guard } = setup(ORIGIN);
    expect(guard.canActivate(context(request('GET')))).toBe(true);
  });

  it('aceita um POST com a origem certa e o token da sessão', () => {
    const { service, guard } = setup(ORIGIN);
    const token = service.tokenFor('sessao-a');
    const req = request('POST', { origin: ORIGIN, cookie: 'nfc_access=sessao-a', 'x-csrf-token': token });
    expect(guard.canActivate(context(req))).toBe(true);
  });

  it('recusa sem token, com o token de outra sessão ou com outra origem', () => {
    const { service, guard } = setup(ORIGIN);
    const cases: Array<[Request, string]> = [
      [request('POST', { origin: ORIGIN, cookie: 'nfc_access=sessao-a' }), 'csrf_invalid'],
      [
        request('POST', { origin: ORIGIN, cookie: 'nfc_access=sessao-a', 'x-csrf-token': service.tokenFor('sessao-b') }),
        'csrf_invalid',
      ],
      [
        request('DELETE', { origin: 'https://atacante.example', 'x-csrf-token': service.tokenFor(null) }),
        'origin_invalid',
      ],
      [request('PATCH', { 'x-csrf-token': service.tokenFor(null) }), 'origin_invalid'],
    ];
    for (const [req, code] of cases) {
      let error: unknown;
      try {
        guard.canActivate(context(req));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({ error: { code } });
    }
  });

  it('rotas @SkipCsrf (autorizadas por código assinado) passam sem token', () => {
    const service = new CsrfService(loadEnv({ IP_HASH_SECRET: 's'.repeat(32), PUBLIC_APP_URL: ORIGIN }));
    const guard = new CsrfGuard(service, reflector(true));
    expect(guard.canActivate(context(request('POST', {})))).toBe(true);
  });

  it('sem origem pública configurada (desenvolvimento) só verifica o token', () => {
    const { service, guard } = setup();
    expect(guard.canActivate(context(request('POST', { 'x-csrf-token': service.tokenFor(null) })))).toBe(true);
  });
});
