import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import type { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { ACCESS_TOKEN_COOKIE, SessionService, readCookie } from './session.service';
import type { SessionUser } from './session-user';

const user: SessionUser = { id: 'u1', email: 'ana@acme.test', role: 'company_admin', companyId: 'co_acme' };

function requestWithCookie(cookie?: string): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as unknown as Request;
}

/** SupabaseAuthService falso: devolve o utilizador só para o token esperado. */
function fakeSupabase(expectedToken: string | null): SupabaseAuthService {
  return {
    getUser: async (token: string) => (token === expectedToken ? user : null),
  } as unknown as SupabaseAuthService;
}

describe('readCookie', () => {
  it('lê o valor de um cookie entre vários', () => {
    expect(readCookie('a=1; nfc_access=abc; b=2', ACCESS_TOKEN_COOKIE)).toBe('abc');
    expect(readCookie('outro=1', ACCESS_TOKEN_COOKIE)).toBeNull();
    expect(readCookie(undefined, ACCESS_TOKEN_COOKIE)).toBeNull();
  });
});

describe('SessionService', () => {
  it('sem cookie não há sessão e o Supabase não é chamado', async () => {
    let called = false;
    const supabase = { getUser: async () => { called = true; return user; } } as unknown as SupabaseAuthService;
    const service = new SessionService(supabase);
    expect(await service.getUser(requestWithCookie())).toBeNull();
    expect(called).toBe(false);
  });

  it('com um token válido devolve o utilizador do Supabase', async () => {
    const service = new SessionService(fakeSupabase('token-bom'));
    expect(await service.getUser(requestWithCookie('nfc_access=token-bom'))).toEqual(user);
  });

  it('com um token que o Supabase rejeita devolve null', async () => {
    const service = new SessionService(fakeSupabase('token-bom'));
    expect(await service.getUser(requestWithCookie('nfc_access=token-mau'))).toBeNull();
  });
});
