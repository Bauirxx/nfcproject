import { LIMITS } from '@nfc-business/shared/constants';
import type { ContactShare, ContactSharePage } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { civilDate, counterKey } from '../domain';
import { contactShareHandlers } from './contact-shares';
import { api, errorCode, readJson, signIn, useMockServer } from './testing';

useMockServer(contactShareHandlers);

const EMAIL_SHARE = { profileId: 'p_paula', channel: 'email', recipient: { name: 'João Matola', email: 'joao.matola@cliente.test' } };

async function send(body: unknown): Promise<Response> {
  return api('POST', '/api/contact-shares', body);
}

async function sendOk(body: unknown): Promise<ContactShare> {
  const response = await send(body);
  expect(response.status).toBe(201);
  return readJson<ContactShare>(response);
}

async function history(query: string = ''): Promise<ContactSharePage> {
  const response = await api('GET', `/api/contact-shares${query}`);
  expect(response.status).toBe(200);
  return readJson<ContactSharePage>(response);
}

describe('POST /api/contact-shares', () => {
  it('exige sessão e permissão de envio', async () => {
    expect((await send(EMAIL_SHARE)).status).toBe(401);
    signIn('u_marta');
    const response = await send(EMAIL_SHARE);
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('forbidden');
  });

  it('regista o envio por email com o destinatário mascarado, o evento e a auditoria', async () => {
    signIn('u_paula');
    const share = await sendOk(EMAIL_SHARE);
    expect(share).toMatchObject({
      profileId: 'p_paula',
      profileName: 'Paula Machava',
      channel: 'email',
      recipientMasked: 'j•••@c•••.test',
    });
    const db = getDb();
    expect(db.shares[0]).toMatchObject({ id: share.id, userId: 'u_paula', cardId: 'c_paula', companyId: 'co_acme' });
    expect(db.counters[counterKey('c_paula', civilDate(), 'contactsSent')]).toBe(1);
    expect(db.audit[0]).toMatchObject({ action: 'contact.sent', target: 'Paula Machava', actorEmail: 'paula.owner@acme.test' });
    // O destinatário completo nunca fica guardado.
    expect(JSON.stringify(db)).not.toContain('joao.matola');
    expect(JSON.stringify(db)).not.toContain('João Matola');
  });

  it('regista WhatsApp e SMS com o número mascarado', async () => {
    signIn('u_paula');
    const whatsapp = await sendOk({ profileId: 'p_paula', channel: 'whatsapp', recipient: { phone: '+258845550101' } });
    expect(whatsapp.recipientMasked).toBe('+258 ••• •• 101');
    const sms = await sendOk({ profileId: 'p_paula', channel: 'sms', recipient: { phone: '+258825550102' }, note: 'Até breve!' });
    expect(sms.channel).toBe('sms');
    expect(JSON.stringify(getDb())).not.toContain('845550101');
  });

  it('só envia perfis que o utilizador pode ver', async () => {
    signIn('u_paula');
    const foreign = await send({ ...EMAIL_SHARE, profileId: 'p_carlos' });
    expect(foreign.status).toBe(404);
    expect(await errorCode(foreign)).toBe('not_found');

    signIn('u_ana');
    expect((await send({ ...EMAIL_SHARE, profileId: 'p_rita' })).status).toBe(404);
    expect((await send({ ...EMAIL_SHARE, profileId: 'p_carlos' })).status).toBe(201);

    signIn('u_edu');
    expect((await send({ ...EMAIL_SHARE, profileId: 'p_recepcao' })).status).toBe(201);
  });

  it('recusa perfis sem cartão ativo', async () => {
    signIn('u_ana');
    for (const card of getDb().cards) {
      if (card.profileId === 'p_carlos' && card.status === 'active') card.status = 'inactive';
    }
    const response = await send({ ...EMAIL_SHARE, profileId: 'p_carlos' });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe('profile_without_card');
    expect(getDb().shares.some((share) => share.profileId === 'p_carlos' && share.userId === 'u_ana' && share.channel === 'email' && share.recipientMasked === 'j•••@c•••.test')).toBe(false);
  });

  it('valida o destinatário, a nota e os campos com o schema partilhado', async () => {
    signIn('u_paula');
    expect((await send({ profileId: 'p_paula', channel: 'email', recipient: { phone: '+258845550101' } })).status).toBe(422);
    expect((await send({ profileId: 'p_paula', channel: 'sms', recipient: { email: 'a@b.test' } })).status).toBe(422);
    expect((await send({ ...EMAIL_SHARE, note: 'Veja https://evil.test' })).status).toBe(422);
    expect((await send({ ...EMAIL_SHARE, note: '<b>olá</b>' })).status).toBe(422);
    expect((await send({ ...EMAIL_SHARE, note: 'a'.repeat(LIMITS.noteMax + 1) })).status).toBe(422);
    expect((await send({ ...EMAIL_SHARE, channel: 'telegram' })).status).toBe(422);
    expect((await send({ ...EMAIL_SHARE, companyId: 'co_beta' })).status).toBe(422);
    expect(getDb().shares.filter((share) => share.userId === 'u_paula')).toHaveLength(3);
  });

  it('limita a 10 envios por hora por utilizador, sem afetar os outros', async () => {
    signIn('u_paula');
    for (let count = 0; count < LIMITS.sharesPerHour; count += 1) {
      expect((await send(EMAIL_SHARE)).status).toBe(201);
    }
    const blocked = await send(EMAIL_SHARE);
    expect(blocked.status).toBe(429);
    expect(await readJson<{ error: { code: string; scope: string } }>(blocked)).toEqual({
      error: { code: 'rate_limited', scope: 'hour' },
    });
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);

    signIn('u_edu');
    expect((await send({ ...EMAIL_SHARE, profileId: 'p_recepcao' })).status).toBe(201);
  });

  it('limita a 50 envios por dia e não conta a tentativa recusada no limite horário', async () => {
    signIn('u_paula');
    const twoHoursAgo = Date.now() - 2 * 3_600_000;
    getDb().attempts['share:day:u_paula'] = Array.from({ length: LIMITS.sharesPerDay }, (_, index) => twoHoursAgo + index);
    const blocked = await send(EMAIL_SHARE);
    expect(blocked.status).toBe(429);
    expect((await readJson<{ error: { scope: string } }>(blocked)).error.scope).toBe('day');
    expect(getDb().attempts['share:hour:u_paula'] ?? []).toHaveLength(0);
    expect(getDb().shares.filter((share) => share.userId === 'u_paula')).toHaveLength(3);
  });
});

describe('GET /api/contact-shares', () => {
  it('o dono vê só os envios dos seus perfis, do mais recente para o mais antigo', async () => {
    signIn('u_paula');
    const page = await history();
    expect(page.total).toBe(3);
    expect(page.items.map((share) => share.channel)).toEqual(['email', 'whatsapp', 'sms']);
    expect(page.items.every((share) => share.profileId === 'p_paula' && share.recipientMasked.includes('•'))).toBe(true);

    const sent = await sendOk({ profileId: 'p_paula', channel: 'sms', recipient: { phone: '+258841110000' } });
    const after = await history();
    expect(after.total).toBe(4);
    expect(after.items[0]?.id).toBe(sent.id);
  });

  it('administradores e editores veem os envios da empresa, com filtro por perfil e paginação', async () => {
    signIn('u_ana');
    const all = await history();
    expect(all.total).toBe(6);
    expect(all.items.some((share) => share.profileName === 'Rita Cossa')).toBe(false);

    const carlos = await history('?profileId=p_carlos');
    expect(carlos.items.map((share) => share.profileName)).toEqual(['Carlos Mondlane', 'Carlos Mondlane']);

    const paged = await history('?pageSize=2&page=2');
    expect(paged).toMatchObject({ page: 2, pageSize: 2, total: 6 });
    expect(paged.items).toHaveLength(2);

    signIn('u_edu');
    expect((await history()).total).toBe(6);
  });

  it('filtrar por um perfil que não se pode ver dá 404', async () => {
    signIn('u_paula');
    const response = await api('GET', '/api/contact-shares?profileId=p_carlos');
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('not_found');
    signIn('u_ana');
    expect((await api('GET', '/api/contact-shares?profileId=p_rita')).status).toBe(404);
  });

  it('exige permissão de envio', async () => {
    expect((await api('GET', '/api/contact-shares')).status).toBe(401);
    signIn('u_marta');
    expect((await api('GET', '/api/contact-shares')).status).toBe(403);
  });
});
