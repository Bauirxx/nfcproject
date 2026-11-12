import { LIMITS } from '@nfc-business/shared/constants';
import type { Profile, ProfilePage } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '../credentials';
import { getDb } from '../db';
import { profileHandlers, slugFor } from './profiles';
import { api, errorCode, readJson, signIn, uploadImage, useMockServer } from './testing';
import { uploadHandlers } from './uploads';

useMockServer([...profileHandlers, ...uploadHandlers]);

const VALID_THEME = { template: 'modern', primaryColor: '#1e40af', backgroundColor: '#ffffff', textColor: '#0f172a' };

async function listProfiles(query: string = ''): Promise<ProfilePage> {
  const response = await api('GET', `/api/profiles${query}`);
  expect(response.status).toBe(200);
  return readJson<ProfilePage>(response);
}

async function patch(id: string, body: unknown): Promise<Response> {
  return api('PATCH', `/api/profiles/${id}`, body);
}

async function patchOk(id: string, body: unknown): Promise<Profile> {
  const response = await patch(id, body);
  expect(response.status).toBe(200);
  return readJson<Profile>(response);
}

describe('GET /api/profiles', () => {
  it('exige sessão e um papel com acesso a perfis', async () => {
    expect((await api('GET', '/api/profiles')).status).toBe(401);
    signIn('u_marta');
    const response = await api('GET', '/api/profiles');
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('forbidden');
  });

  it('lista os perfis da empresa por ordem alfabética, com cartão ativo e contagens', async () => {
    signIn('u_ana');
    const page = await listProfiles();
    expect(page.total).toBe(3);
    expect(page.items.map((profile) => profile.displayName)).toEqual(['Carlos Mondlane', 'Paula Machava', 'Receção Acme']);
    expect(page.items[1]).toMatchObject({
      id: 'p_paula',
      slug: 'paula-machava',
      ownerName: 'Paula Machava',
      activeCardToken: MOCK_TOKENS.activeCard,
      cardsCount: 2,
    });
    expect(page.items[2]).toMatchObject({ ownerUserId: null, ownerName: null, cardsCount: 2 });
    expect(page.items[2]?.activeCardToken).toBe(getDb().cards.find((card) => card.id === 'c_recepcao')?.token);
  });

  it('o dono só vê o seu perfil', async () => {
    signIn('u_paula');
    expect((await listProfiles()).items.map((profile) => profile.id)).toEqual(['p_paula']);
    signIn('u_carlos');
    expect((await listProfiles()).items.map((profile) => profile.id)).toEqual(['p_carlos']);
  });

  it('pesquisa pelo nome, cargo ou empresa', async () => {
    signIn('u_edu');
    expect((await listProfiles('?search=rece')).items.map((profile) => profile.id)).toEqual(['p_recepcao']);
    expect((await listProfiles('?search=t%C3%A9cnico')).items.map((profile) => profile.id)).toEqual(['p_carlos']);
    expect((await listProfiles('?search=acme')).total).toBe(3);
    expect((await listProfiles('?search=rita')).total).toBe(0);
  });
});

describe('POST /api/profiles', () => {
  it('cria um perfil com valores por defeito, endereço amigável único e auditoria', async () => {
    signIn('u_edu');
    const response = await api('POST', '/api/profiles', { displayName: '  Nuno Ngoenha ' });
    expect(response.status).toBe(201);
    const created = await readJson<Profile>(response);
    expect(created).toMatchObject({
      displayName: 'Nuno Ngoenha',
      slug: 'nuno-ngoenha',
      ownerUserId: null,
      title: null,
      company: 'Acme Moçambique',
      visibility: { title: true, company: true, bio: true, photo: true },
      contacts: [],
      socialLinks: [],
      theme: { template: 'classic', logoUrl: null },
      activeCardToken: null,
      cardsCount: 0,
    });
    expect(getDb().audit[0]).toMatchObject({ action: 'profile.created', target: 'Nuno Ngoenha', companyId: 'co_acme' });

    const duplicate = await readJson<Profile>(await api('POST', '/api/profiles', { displayName: 'Nuno Ngoenha' }));
    expect(duplicate.slug).toBe('nuno-ngoenha-2');
    expect((await listProfiles()).total).toBe(5);
  });

  it('só company_admin atribui o dono, que tem de ser da empresa', async () => {
    signIn('u_edu');
    const forbidden = await api('POST', '/api/profiles', { displayName: 'Com Dono', ownerUserId: 'u_carlos' });
    expect(forbidden.status).toBe(403);
    expect(await errorCode(forbidden)).toBe('forbidden');

    signIn('u_ana');
    const foreign = await api('POST', '/api/profiles', { displayName: 'Com Dono', ownerUserId: 'u_rita' });
    expect(foreign.status).toBe(404);

    const owned = await readJson<Profile>(await api('POST', '/api/profiles', { displayName: 'Com Dono', ownerUserId: 'u_carlos' }));
    expect(owned).toMatchObject({ ownerUserId: 'u_carlos', ownerName: 'Carlos Mondlane' });
  });

  it('o dono de perfil não cria perfis e o corpo é validado', async () => {
    signIn('u_paula');
    expect((await api('POST', '/api/profiles', { displayName: 'Outro' })).status).toBe(403);
    signIn('u_ana');
    expect((await api('POST', '/api/profiles', { displayName: 'A' })).status).toBe(422);
    expect((await api('POST', '/api/profiles', { displayName: 'Válido', slug: 'forjado' })).status).toBe(422);
  });
});

describe('slugFor', () => {
  it('remove acentos e símbolos e garante o tamanho mínimo', () => {
    const db = getDb();
    expect(slugFor(db, 'José Çá-Ngoenha!')).toBe('jose-ca-ngoenha');
    expect(slugFor(db, 'Paula Machava')).toBe('paula-machava-2');
    expect(slugFor(db, 'Li')).toBe('perfil-li');
    expect(slugFor(db, '!!!')).toBe('perfil');
    expect(slugFor(db, 'a'.repeat(80))).toHaveLength(40);
  });
});

describe('GET /api/profiles/:id', () => {
  it('respeita a empresa e a posse', async () => {
    signIn('u_ana');
    expect((await api('GET', '/api/profiles/p_paula')).status).toBe(200);
    expect((await api('GET', '/api/profiles/p_rita')).status).toBe(404);
    signIn('u_paula');
    expect((await api('GET', '/api/profiles/p_paula')).status).toBe(200);
    const other = await api('GET', '/api/profiles/p_carlos');
    expect(other.status).toBe(404);
    expect(await errorCode(other)).toBe('not_found');
  });
});

describe('PATCH /api/profiles/:id', () => {
  it('o dono edita os campos, os contactos e a visibilidade do seu perfil', async () => {
    signIn('u_paula');
    const before = getDb().profiles.find((profile) => profile.id === 'p_paula')?.updatedAt;
    const updated = await patchOk('p_paula', {
      title: 'Diretora Comercial',
      bio: '',
      visibility: { title: true, company: false, bio: true, photo: true },
      contacts: [{ id: 'ct_paula_1', type: 'phone', value: '+258841234567', isPublic: true }],
      socialLinks: [],
    });
    expect(updated).toMatchObject({
      title: 'Diretora Comercial',
      bio: null,
      visibility: { company: false },
      socialLinks: [],
    });
    expect(updated.contacts).toHaveLength(1);
    expect(updated.updatedAt >= (before ?? '')).toBe(true);
    expect(getDb().audit[0]).toMatchObject({ action: 'profile.updated', target: 'Paula Machava' });
  });

  it('valida contactos, redes sociais e limites com o schema partilhado', async () => {
    signIn('u_paula');
    expect((await patch('p_paula', { contacts: [{ id: 'x', type: 'phone', value: '123', isPublic: true }] })).status).toBe(422);
    expect(
      (await patch('p_paula', { socialLinks: [{ id: 'x', platform: 'linkedin', url: 'https://evil.test/in/p', isPublic: true }] }))
        .status,
    ).toBe(422);
    const tooMany = Array.from({ length: LIMITS.contactsMax + 1 }, (_, index) => ({
      id: `c${index}`,
      type: 'email',
      value: `p${index}@acme.test`,
      isPublic: true,
    }));
    expect((await patch('p_paula', { contacts: tooMany })).status).toBe(422);
    expect((await patch('p_paula', { slug: 'novo-slug' })).status).toBe(422);
  });

  it('o dono não altera o tema nem o dono do perfil', async () => {
    signIn('u_paula');
    const theme = await patch('p_paula', { theme: VALID_THEME });
    expect(theme.status).toBe(403);
    expect(await errorCode(theme)).toBe('forbidden');
    expect((await patch('p_paula', { ownerUserId: null })).status).toBe(403);
    expect(getDb().profiles.find((profile) => profile.id === 'p_paula')?.theme.template).toBe('classic');
  });

  it('o editor altera o tema, com contraste AA obrigatório, mas não o dono', async () => {
    signIn('u_edu');
    const updated = await patchOk('p_paula', { theme: VALID_THEME });
    expect(updated.theme).toEqual({ ...VALID_THEME, logoUrl: null });

    const lowContrast = await patch('p_paula', { theme: { ...VALID_THEME, textColor: '#dddddd' } });
    expect(lowContrast.status).toBe(422);
    expect((await patch('p_paula', { ownerUserId: 'u_carlos' })).status).toBe(403);
  });

  it('company_admin atribui e retira o dono, sempre dentro da empresa', async () => {
    signIn('u_ana');
    expect(await patchOk('p_recepcao', { ownerUserId: 'u_edu' })).toMatchObject({ ownerUserId: 'u_edu', ownerName: 'Eduardo Sitoe' });
    expect(await patchOk('p_recepcao', { ownerUserId: null })).toMatchObject({ ownerUserId: null, ownerName: null });
    expect((await patch('p_recepcao', { ownerUserId: 'u_rita' })).status).toBe(404);
    expect((await patch('p_rita', { title: 'Tentativa' })).status).toBe(404);
  });

  it('define e remove a fotografia a partir de um upload do próprio', async () => {
    signIn('u_paula');
    const photoFileId = await uploadImage('profile_photo', 'jpeg');
    expect((await patchOk('p_paula', { photoFileId })).photoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect((await patchOk('p_paula', { photoFileId: null })).photoUrl).toBeNull();

    const invalid = await patch('p_paula', { photoFileId: 'f_inexistente' });
    expect(invalid.status).toBe(422);
    expect(await errorCode(invalid)).toBe('invalid_file');
  });

  it('não aceita a fotografia carregada por outro utilizador', async () => {
    signIn('u_carlos');
    const foreignPhoto = await uploadImage('profile_photo');
    signIn('u_paula');
    const response = await patch('p_paula', { photoFileId: foreignPhoto });
    expect(response.status).toBe(422);
    expect(getDb().profiles.find((profile) => profile.id === 'p_paula')?.photoUrl).toBeNull();
  });

  it('o logótipo do tema é definido, mantido e removido pelo tema', async () => {
    signIn('u_edu');
    const logoFileId = await uploadImage('theme_logo', 'webp');
    const withLogo = await patchOk('p_carlos', { theme: { ...VALID_THEME, logoFileId } });
    expect(withLogo.theme.logoUrl).toMatch(/^data:image\/webp;base64,/);

    const kept = await patchOk('p_carlos', { theme: { ...VALID_THEME, template: 'minimal' } });
    expect(kept.theme).toMatchObject({ template: 'minimal', logoUrl: withLogo.theme.logoUrl });

    const removed = await patchOk('p_carlos', { theme: { ...VALID_THEME, logoFileId: null } });
    expect(removed.theme.logoUrl).toBeNull();
  });

  it('não consome o upload quando a autorização falha', async () => {
    signIn('u_paula');
    const photoFileId = await uploadImage('profile_photo');
    expect((await patch('p_paula', { photoFileId, theme: VALID_THEME })).status).toBe(403);
    expect(getDb().uploads[photoFileId]).toBeDefined();
    expect(getDb().profiles.find((profile) => profile.id === 'p_paula')?.photoUrl).toBeNull();
  });
});
