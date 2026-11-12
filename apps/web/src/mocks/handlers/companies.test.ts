import type { Company, CompanyList } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { companyHandlers } from './companies';
import { api, errorCode, readJson, signIn, uploadImage, useMockServer } from './testing';
import { uploadHandlers } from './uploads';

useMockServer([...companyHandlers, ...uploadHandlers]);

const NEW_COMPANY = {
  name: 'Gama Serviços',
  contactEmail: 'geral@gama.test',
  adminEmail: 'admin@gama.test',
  brand: { primaryColor: '#7c2d12', accentColor: '#1e3a8a' },
};

describe('GET /api/companies', () => {
  it('só platform_admin acede', async () => {
    expect((await api('GET', '/api/companies')).status).toBe(401);
    signIn('u_ana');
    const forbidden = await api('GET', '/api/companies');
    expect(forbidden.status).toBe(403);
    expect(await errorCode(forbidden)).toBe('forbidden');
  });

  it('lista as empresas por ordem alfabética com contagens de cartões e membros', async () => {
    signIn('u_marta');
    const response = await api('GET', '/api/companies');
    expect(response.status).toBe(200);
    const { items } = await readJson<CompanyList>(response);
    expect(items.map((company) => company.name)).toEqual(['Acme Moçambique', 'Beta Logística']);
    expect(items[0]).toMatchObject({ id: 'co_acme', cardsCount: 28, membersCount: 5, logoUrl: null });
    expect(items[1]).toMatchObject({ id: 'co_beta', cardsCount: 2, membersCount: 2 });
  });
});

describe('POST /api/companies', () => {
  it('cria a empresa, convida o primeiro administrador e regista na auditoria', async () => {
    signIn('u_marta');
    const response = await api('POST', '/api/companies', NEW_COMPANY);
    expect(response.status).toBe(201);
    const company = await readJson<Company>(response);
    expect(company).toMatchObject({ name: 'Gama Serviços', cardsCount: 0, membersCount: 1, logoUrl: null });

    const db = getDb();
    const admin = db.users.find((user) => user.email === 'admin@gama.test');
    expect(admin).toMatchObject({ role: 'company_admin', companyId: company.id, status: 'invited', password: null });
    expect(Object.values(db.inviteTokens).some((token) => token.userId === admin?.id)).toBe(true);
    expect(db.audit.slice(0, 2).map((entry) => [entry.action, entry.companyId])).toEqual([
      ['member.invited', company.id],
      ['company.created', company.id],
    ]);
  });

  it('não convida um email que já tem conta', async () => {
    signIn('u_marta');
    const response = await api('POST', '/api/companies', { ...NEW_COMPANY, adminEmail: 'rita.owner@beta.test' });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe('already_member');
    expect(getDb().companies).toHaveLength(2);
  });

  it('valida o corpo com o schema partilhado', async () => {
    signIn('u_marta');
    expect((await api('POST', '/api/companies', { ...NEW_COMPANY, brand: { primaryColor: 'azul', accentColor: '#000000' } })).status).toBe(422);
    expect((await api('POST', '/api/companies', { ...NEW_COMPANY, name: 'G' })).status).toBe(422);
    expect((await api('POST', '/api/companies', { ...NEW_COMPANY, id: 'co_forjado' })).status).toBe(422);
  });

  it('aceita um logótipo carregado antes e recusa identificadores inválidos', async () => {
    signIn('u_marta');
    const invalid = await api('POST', '/api/companies', { ...NEW_COMPANY, logoFileId: 'f_inexistente' });
    expect(invalid.status).toBe(422);
    expect(await errorCode(invalid)).toBe('invalid_file');

    const logoFileId = await uploadImage('company_logo', 'webp');
    const response = await api('POST', '/api/companies', { ...NEW_COMPANY, logoFileId });
    expect(response.status).toBe(201);
    expect((await readJson<Company>(response)).logoUrl).toMatch(/^data:image\/webp;base64,/);
    expect(getDb().uploads[logoFileId]).toBeUndefined();
  });
});

describe('GET e PATCH /api/companies/:id', () => {
  it('devolve 404 para empresas desconhecidas', async () => {
    signIn('u_marta');
    const response = await api('GET', '/api/companies/co_inexistente');
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('not_found');
    expect((await api('PATCH', '/api/companies/co_inexistente', { name: 'Outra' })).status).toBe(404);
  });

  it('devolve e atualiza uma empresa, com registo na auditoria', async () => {
    signIn('u_marta');
    expect((await readJson<Company>(await api('GET', '/api/companies/co_beta'))).name).toBe('Beta Logística');

    const response = await api('PATCH', '/api/companies/co_beta', {
      name: 'Beta Logística, Lda.',
      brand: { primaryColor: '#111111', accentColor: '#222222' },
    });
    expect(response.status).toBe(200);
    expect(await readJson<Company>(response)).toMatchObject({
      name: 'Beta Logística, Lda.',
      contactEmail: 'contacto@beta.test',
      brand: { primaryColor: '#111111', accentColor: '#222222' },
    });
    expect(getDb().audit[0]).toMatchObject({ action: 'company.updated', target: 'Beta Logística, Lda.', companyId: 'co_beta' });
  });

  it('define e remove o logótipo', async () => {
    signIn('u_marta');
    const logoFileId = await uploadImage('company_logo');
    const withLogo = await readJson<Company>(await api('PATCH', '/api/companies/co_acme', { logoFileId }));
    expect(withLogo.logoUrl).toMatch(/^data:image\/png;base64,/);

    const withoutLogo = await readJson<Company>(await api('PATCH', '/api/companies/co_acme', { logoFileId: null }));
    expect(withoutLogo.logoUrl).toBeNull();
  });

  it('não aceita um logótipo carregado por outro utilizador', async () => {
    signIn('u_edu');
    const themeLogo = await uploadImage('theme_logo');
    signIn('u_marta');
    const response = await api('PATCH', '/api/companies/co_acme', { logoFileId: themeLogo });
    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe('invalid_file');
  });
});
