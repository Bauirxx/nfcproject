import { describe, expect, it } from 'vitest';
import { mapSupabaseUser } from './supabase-auth.service';

describe('mapSupabaseUser', () => {
  it('lê o papel e a empresa do app_metadata', () => {
    expect(
      mapSupabaseUser({
        id: 'u1',
        email: 'ana@acme.test',
        app_metadata: { role: 'company_admin', company_id: 'co_acme' },
      }),
    ).toEqual({ id: 'u1', email: 'ana@acme.test', role: 'company_admin', companyId: 'co_acme' });
  });

  it('admite empresa nula (por exemplo, platform_admin)', () => {
    expect(mapSupabaseUser({ id: 'u2', email: 'marta@nfc.test', app_metadata: { role: 'platform_admin' } })).toEqual({
      id: 'u2',
      email: 'marta@nfc.test',
      role: 'platform_admin',
      companyId: null,
    });
  });

  it('devolve null sem email ou sem papel', () => {
    expect(mapSupabaseUser({ id: 'u3', app_metadata: { role: 'company_admin' } })).toBeNull();
    expect(mapSupabaseUser({ id: 'u4', email: 'x@y.test', app_metadata: {} })).toBeNull();
    expect(mapSupabaseUser({ id: 'u5', email: 'x@y.test', app_metadata: null })).toBeNull();
  });
});
