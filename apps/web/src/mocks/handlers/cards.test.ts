import type { Card, CardHistory, CardPage } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { cardHandlers } from './cards';
import { api, errorCode, readJson, signIn, useMockServer } from './testing';

useMockServer(cardHandlers);

async function listCards(query: string = ''): Promise<CardPage> {
  const response = await api('GET', `/api/cards${query}`);
  expect(response.status).toBe(200);
  return readJson<CardPage>(response);
}

async function card(id: string): Promise<Card> {
  const response = await api('GET', `/api/cards/${id}`);
  expect(response.status).toBe(200);
  return readJson<Card>(response);
}

async function act(id: string, action: string): Promise<Response> {
  return api('POST', `/api/cards/${id}/${action}`);
}

async function historyActions(id: string): Promise<string[]> {
  const response = await api('GET', `/api/cards/${id}/history`);
  expect(response.status).toBe(200);
  return (await readJson<CardHistory>(response)).items.map((entry) => entry.action);
}

describe('GET /api/cards', () => {
  it('exige sessão e o papel certo', async () => {
    expect((await api('GET', '/api/cards')).status).toBe(401);
    for (const userId of ['u_paula', 'u_marta']) {
      signIn(userId);
      const response = await api('GET', '/api/cards');
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe('forbidden');
    }
    signIn('u_nelson');
    expect(await errorCode(await api('GET', '/api/cards'))).toBe('mfa_setup_required');
  });

  it('lista só os cartões da empresa, paginados e do mais recente para o mais antigo', async () => {
    signIn('u_ana');
    const first = await listCards();
    expect(first).toMatchObject({ page: 1, pageSize: 20, total: 28 });
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.id).toBe('c_lost');
    expect(first.items.every((item) => !item.id.startsWith('c_rita') && item.id !== 'c_beta_stock')).toBe(true);

    const second = await listCards('?page=2');
    expect(second.items).toHaveLength(8);

    const smallPage = await listCards('?page=3&pageSize=10');
    expect(smallPage.items).toHaveLength(8);
  });

  it('filtra por estado e pesquisa pela etiqueta ou pelo nome do perfil', async () => {
    signIn('u_edu');
    const active = await listCards('?status=active');
    expect(active.items.map((item) => item.id).sort()).toEqual(['c_carlos', 'c_paula', 'c_recepcao']);

    const byLabel = await listCards('?search=paula');
    expect(byLabel.items.map((item) => item.id).sort()).toEqual(['c_paula', 'c_paula2']);

    const byProfile = await listCards('?search=Receção%20Acme');
    expect(byProfile.items.map((item) => item.id).sort()).toEqual(['c_blocked', 'c_recepcao']);

    const combined = await listCards('?search=paula&status=inactive');
    expect(combined.items.map((item) => item.id)).toEqual(['c_paula2']);
    expect(combined.items[0]).toMatchObject({ profileId: 'p_paula', profileName: 'Paula Machava' });
  });

  it('recusa parâmetros fora do contrato', async () => {
    signIn('u_ana');
    const badStatus = await api('GET', '/api/cards?status=roubado');
    expect(badStatus.status).toBe(400);
    expect(await errorCode(badStatus)).toBe('invalid_request');
    expect((await api('GET', '/api/cards?pageSize=500')).status).toBe(400);
    expect((await api('GET', '/api/cards?page=0')).status).toBe(400);
  });
});

describe('POST /api/cards', () => {
  it('cria um cartão inativo com token aleatório e regista o histórico e a auditoria', async () => {
    signIn('u_edu');
    const response = await api('POST', '/api/cards', { label: '  Feira de Maputo 2026  ' });
    expect(response.status).toBe(201);
    const created = await readJson<Card>(response);
    expect(created).toMatchObject({ label: 'Feira de Maputo 2026', status: 'inactive', profileId: null, profileName: null });
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(getDb().cards.find((candidate) => candidate.id === created.id)).toMatchObject({ companyId: 'co_acme', demoWeight: 0 });
    expect(await historyActions(created.id)).toEqual(['created']);
    expect(getDb().audit[0]).toMatchObject({ action: 'card.created', target: 'Feira de Maputo 2026', companyId: 'co_acme' });
    expect((await listCards()).total).toBe(29);
  });

  it('associa logo um perfil da empresa, mas nunca um perfil de outra empresa', async () => {
    signIn('u_ana');
    const response = await api('POST', '/api/cards', { label: 'Paula · evento', profileId: 'p_paula' });
    const created = await readJson<Card>(response);
    expect(created).toMatchObject({ profileId: 'p_paula', profileName: 'Paula Machava' });
    expect(await historyActions(created.id)).toEqual(['profile_linked', 'created']);

    const foreign = await api('POST', '/api/cards', { label: 'Rita · evento', profileId: 'p_rita' });
    expect(foreign.status).toBe(404);
    expect(await errorCode(foreign)).toBe('not_found');
  });

  it('valida a etiqueta e só aceita quem gere cartões', async () => {
    signIn('u_ana');
    expect((await api('POST', '/api/cards', { label: 'X' })).status).toBe(422);
    expect((await api('POST', '/api/cards', { label: 'Válido', status: 'active' })).status).toBe(422);
    signIn('u_paula');
    expect((await api('POST', '/api/cards', { label: 'Tentativa' })).status).toBe(403);
  });
});

describe('GET e PATCH /api/cards/:id', () => {
  it('devolve o cartão da empresa e 404 para os outros', async () => {
    signIn('u_ana');
    expect(await card('c_paula')).toMatchObject({ label: 'Paula Machava · principal', status: 'active', profileName: 'Paula Machava' });
    for (const id of ['c_rita', 'c_inexistente']) {
      const response = await api('GET', `/api/cards/${id}`);
      expect(response.status).toBe(404);
      expect(await errorCode(response)).toBe('not_found');
    }
  });

  it('muda a etiqueta e associa ou desassocia o perfil, com histórico', async () => {
    signIn('u_edu');
    const relabeled = await readJson<Card>(await api('PATCH', '/api/cards/c_stock_001', { label: 'Stock 001 · balcão' }));
    expect(relabeled.label).toBe('Stock 001 · balcão');
    expect(getDb().audit[0]).toMatchObject({ action: 'card.updated', target: 'Stock 001 · balcão' });

    const linked = await readJson<Card>(await api('PATCH', '/api/cards/c_stock_001', { profileId: 'p_recepcao' }));
    expect(linked).toMatchObject({ profileId: 'p_recepcao', profileName: 'Receção Acme' });

    const unlinked = await readJson<Card>(await api('PATCH', '/api/cards/c_stock_001', { profileId: null }));
    expect(unlinked.profileId).toBeNull();
    expect(await historyActions('c_stock_001')).toEqual(['profile_unlinked', 'profile_linked', 'updated', 'created']);
  });

  it('não desassocia o perfil de um cartão ativo nem associa perfis de outra empresa', async () => {
    signIn('u_ana');
    const active = await api('PATCH', '/api/cards/c_paula', { profileId: null });
    expect(active.status).toBe(409);
    expect(await errorCode(active)).toBe('card_without_profile');
    expect((await card('c_paula')).profileId).toBe('p_paula');

    expect((await api('PATCH', '/api/cards/c_stock_002', { profileId: 'p_rita' })).status).toBe(404);
    expect((await api('PATCH', '/api/cards/c_rita', { label: 'Tentativa' })).status).toBe(404);
  });

  it('sem alterações não acrescenta histórico nem auditoria', async () => {
    signIn('u_ana');
    const auditBefore = getDb().audit.length;
    const response = await api('PATCH', '/api/cards/c_paula', { label: 'Paula Machava · principal', profileId: 'p_paula' });
    expect(response.status).toBe(200);
    expect(await historyActions('c_paula')).toHaveLength(3);
    expect(getDb().audit).toHaveLength(auditBefore);
  });
});

describe('ações sobre o estado do cartão', () => {
  it('percorre as transições permitidas com histórico e auditoria', async () => {
    signIn('u_edu');
    await api('PATCH', '/api/cards/c_stock_003', { profileId: 'p_carlos' });

    expect((await readJson<Card>(await act('c_stock_003', 'activate'))).status).toBe('active');
    expect(getDb().audit[0]).toMatchObject({ action: 'card.activated', target: 'Stock 003' });
    expect((await readJson<Card>(await act('c_stock_003', 'deactivate'))).status).toBe('inactive');
    expect((await readJson<Card>(await act('c_stock_003', 'lost'))).status).toBe('lost');
    expect((await readJson<Card>(await act('c_stock_003', 'activate'))).status).toBe('active');
    expect((await readJson<Card>(await act('c_stock_003', 'block'))).status).toBe('blocked');
    expect(getDb().audit[0]?.action).toBe('card.blocked');
    expect(await historyActions('c_stock_003')).toEqual([
      'blocked',
      'activated',
      'lost',
      'deactivated',
      'activated',
      'profile_linked',
      'created',
    ]);
  });

  it('recusa transições inválidas e o bloqueio é definitivo', async () => {
    signIn('u_ana');
    const deactivateInactive = await act('c_stock_004', 'deactivate');
    expect(deactivateInactive.status).toBe(409);
    expect(await errorCode(deactivateInactive)).toBe('invalid_transition');

    for (const action of ['activate', 'deactivate', 'lost', 'block']) {
      const response = await act('c_blocked', action);
      expect(response.status).toBe(409);
      expect(await errorCode(response)).toBe('invalid_transition');
    }
    expect((await card('c_blocked')).status).toBe('blocked');
  });

  it('não ativa um cartão sem perfil', async () => {
    signIn('u_ana');
    const response = await act('c_stock_005', 'activate');
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe('card_without_profile');
    expect((await card('c_stock_005')).status).toBe('inactive');
  });

  it('cartões de outra empresa dão 404 em todas as ações', async () => {
    signIn('u_ana');
    for (const action of ['activate', 'deactivate', 'lost', 'block']) {
      expect((await act('c_rita', action)).status).toBe(404);
    }
    expect(getDb().cards.find((candidate) => candidate.id === 'c_rita')?.status).toBe('active');
  });

  it('só quem gere cartões pode mudar o estado', async () => {
    signIn('u_paula');
    expect((await act('c_paula', 'deactivate')).status).toBe(403);
  });
});

describe('GET /api/cards/:id/history', () => {
  it('devolve o histórico do mais recente para o mais antigo', async () => {
    signIn('u_ana');
    expect(await historyActions('c_lost')).toEqual(['lost', 'activated', 'profile_linked', 'created']);
    const response = await api('GET', '/api/cards/c_lost/history');
    const { items } = await readJson<CardHistory>(response);
    expect(items[0]).toMatchObject({ action: 'lost', actorName: 'Eduardo Sitoe' });
  });

  it('é isolado por empresa', async () => {
    signIn('u_ana');
    expect((await api('GET', '/api/cards/c_rita/history')).status).toBe(404);
  });
});
