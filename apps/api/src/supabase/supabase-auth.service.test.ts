import { describe, expect, it } from 'vitest';
import { mapSupabaseUser, readAal } from './supabase-auth.service';

const jwt = (claims: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.assinatura`;

describe('mapSupabaseUser', () => {
  it('lê o papel e a empresa do app_metadata e o nome do user_metadata', () => {
    expect(
      mapSupabaseUser({
        id: 'u1',
        email: 'ana@acme.test',
        app_metadata: { role: 'company_admin', company_id: 'co_acme' },
        user_metadata: { name: 'Ana Silva' },
      }),
    ).toEqual({
      id: 'u1',
      email: 'ana@acme.test',
      name: 'Ana Silva',
      role: 'company_admin',
      companyId: 'co_acme',
      mfaEnabled: false,
    });
  });

  it('sem nome usa a parte local do email; empresa nula para platform_admin', () => {
    expect(mapSupabaseUser({ id: 'u2', email: 'marta@nfc.test', app_metadata: { role: 'platform_admin' } })).toMatchObject(
      { name: 'marta', role: 'platform_admin', companyId: null },
    );
  });

  it('o MFA só conta com um fator TOTP verificado', () => {
    const base = { id: 'u3', email: 'x@y.test', app_metadata: { role: 'platform_admin' } };
    expect(mapSupabaseUser({ ...base, factors: [{ factor_type: 'totp', status: 'unverified' }] })?.mfaEnabled).toBe(false);
    expect(mapSupabaseUser({ ...base, factors: [{ factor_type: 'totp', status: 'verified' }] })?.mfaEnabled).toBe(true);
  });

  it('devolve null sem email, sem papel ou com um papel desconhecido', () => {
    expect(mapSupabaseUser({ id: 'u3', app_metadata: { role: 'company_admin' } })).toBeNull();
    expect(mapSupabaseUser({ id: 'u4', email: 'x@y.test', app_metadata: {} })).toBeNull();
    expect(mapSupabaseUser({ id: 'u5', email: 'x@y.test', app_metadata: null })).toBeNull();
    expect(mapSupabaseUser({ id: 'u6', email: 'x@y.test', app_metadata: { role: 'root' } })).toBeNull();
  });
});

describe('readAal', () => {
  it('lê o nível de garantia do token e assume aal1 em caso de dúvida', () => {
    expect(readAal(jwt({ aal: 'aal2' }))).toBe('aal2');
    expect(readAal(jwt({ aal: 'aal1' }))).toBe('aal1');
    expect(readAal(jwt({}))).toBe('aal1');
    expect(readAal('lixo')).toBe('aal1');
    expect(readAal('a.%%%.c')).toBe('aal1');
  });
});
