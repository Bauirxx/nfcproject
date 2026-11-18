import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { ACCESS_TOKEN_COOKIE, SessionService, readCookie } from './session.service';
import type { AuthIdentity } from './session-user';

const jwt = (aal: string) => `h.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.s`;
const TOKEN_AAL1 = jwt('aal1');
const TOKEN_AAL2 = jwt('aal2');

const editor: AuthIdentity = {
  id: 'u1',
  email: 'edu@acme.test',
  name: 'Edu',
  role: 'company_editor',
  companyId: 'co_acme',
  mfaEnabled: false,
};

function requestWithCookie(cookie?: string): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as unknown as Request;
}

function setup(identity: AuthIdentity | null, companyName: string | null = 'ACME') {
  const supabase = { getUser: vi.fn(async () => identity) } as unknown as SupabaseAuthService;
  const query = vi.fn(async () => ({ rows: companyName ? [{ name: companyName }] : [] }));
  const database = {
    configured: true,
    withContext: vi.fn(async (_ctx: unknown, work: (db: { query: typeof query }) => Promise<unknown>) => work({ query })),
  } as unknown as DatabaseService;
  return { service: new SessionService(supabase, database), supabase, database, query };
}

describe('readCookie', () => {
  it('lê o valor de um cookie entre vários e tolera valores mal codificados', () => {
    expect(readCookie('a=1; nfc_access=abc; b=2', ACCESS_TOKEN_COOKIE)).toBe('abc');
    expect(readCookie('outro=1', ACCESS_TOKEN_COOKIE)).toBeNull();
    expect(readCookie(undefined, ACCESS_TOKEN_COOKIE)).toBeNull();
    expect(readCookie('nfc_access=%E0%A4%A', ACCESS_TOKEN_COOKIE)).toBeNull();
  });
});

describe('SessionService', () => {
  it('sem cookie não há sessão e o Supabase não é chamado', async () => {
    const { service, supabase } = setup(editor);
    expect(await service.resolve(requestWithCookie())).toBeNull();
    expect(supabase.getUser).not.toHaveBeenCalled();
  });

  it('completa o utilizador com o contrato inteiro e o nome da empresa (contexto RLS da empresa)', async () => {
    const { service, database } = setup(editor);
    const session = await service.resolve(requestWithCookie(`nfc_access=${TOKEN_AAL1}`));
    expect(session?.user).toEqual({
      id: 'u1',
      name: 'Edu',
      email: 'edu@acme.test',
      role: 'company_editor',
      companyId: 'co_acme',
      companyName: 'ACME',
      mfaEnabled: false,
      mfaRequired: false,
    });
    expect(database.withContext).toHaveBeenCalledWith({ companyId: 'co_acme', isPlatformAdmin: false }, expect.any(Function));
    expect(session).toMatchObject({ mfaPending: false, mfaSetupRequired: false });
  });

  it('administrador sem MFA: sessão válida mas só para configurar o MFA', async () => {
    const { service } = setup({ ...editor, role: 'platform_admin', companyId: null });
    const session = await service.resolve(requestWithCookie(`nfc_access=${TOKEN_AAL1}`));
    expect(session?.user).toMatchObject({ mfaRequired: true, mfaEnabled: false, companyName: null });
    expect(session?.mfaSetupRequired).toBe(true);
  });

  it('com MFA ativo, só há sessão depois de verificar o segundo fator (aal2)', async () => {
    const { service } = setup({ ...editor, role: 'company_admin', mfaEnabled: true });
    expect(await service.getUser(requestWithCookie(`nfc_access=${TOKEN_AAL1}`))).toBeNull();
    expect((await service.resolve(requestWithCookie(`nfc_access=${TOKEN_AAL1}`)))?.mfaPending).toBe(true);
    expect(await service.getUser(requestWithCookie(`nfc_access=${TOKEN_AAL2}`))).toMatchObject({ mfaEnabled: true });
  });

  it('com um token que o Supabase rejeita não há sessão', async () => {
    const { service } = setup(null);
    expect(await service.getUser(requestWithCookie('nfc_access=token-mau'))).toBeNull();
  });
});
