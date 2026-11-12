import type { AuditPage } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { civilDate } from '../domain';
import { auditHandlers } from './audit';
import { api, errorCode, readJson, signIn, useMockServer } from './testing';

useMockServer(auditHandlers);

async function audit(query: string = ''): Promise<AuditPage> {
  const response = await api('GET', `/api/audit${query}`);
  expect(response.status).toBe(200);
  return readJson<AuditPage>(response);
}

describe('GET /api/audit', () => {
  it('só administradores acedem', async () => {
    expect((await api('GET', '/api/audit')).status).toBe(401);
    for (const userId of ['u_edu', 'u_paula']) {
      signIn(userId);
      const response = await api('GET', '/api/audit');
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe('forbidden');
    }
    signIn('u_nelson');
    expect(await errorCode(await api('GET', '/api/audit'))).toBe('mfa_setup_required');
  });

  it('company_admin vê só as ações da sua empresa, paginadas e da mais recente para a mais antiga', async () => {
    signIn('u_ana');
    const first = await audit();
    // `signIn` passa por `startSession`, que regista um `auth.login`: as contagens incluem essa entrada.
    expect(first).toMatchObject({ page: 1, pageSize: 20, total: 33 });
    expect(first.items[0]).toMatchObject({ action: 'auth.login', actorEmail: 'ana.admin@acme.test' });
    expect(first.items).toHaveLength(20);
    expect(first.items.every((entry) => entry.companyName === 'Acme Moçambique')).toBe(true);
    expect(first.items.some((entry) => entry.action === 'company.created')).toBe(false);
    for (let index = 1; index < first.items.length; index += 1) {
      expect((first.items[index - 1]?.createdAt ?? '') >= (first.items[index]?.createdAt ?? '')).toBe(true);
    }
    expect((await audit('?page=2')).items).toHaveLength(13);
  });

  it('platform_admin vê todas as empresas e as ações da plataforma', async () => {
    signIn('u_marta');
    const all = await audit('?pageSize=100');
    expect(all.total).toBe(38);
    expect(all.items.filter((entry) => entry.companyName === 'Beta Logística')).toHaveLength(4);
    expect(all.items.filter((entry) => entry.companyName === null)).toHaveLength(2);
    const created = await audit('?action=company.created');
    expect(created.items).toHaveLength(1);
    expect(created.items[0]).toMatchObject({ actorName: 'Marta Nhaca', target: 'Beta Logística', companyName: 'Beta Logística' });
  });

  it('filtra por ação e por autor (nome ou email, sem distinguir maiúsculas)', async () => {
    signIn('u_ana');
    expect((await audit('?action=auth.login')).total).toBe(7);
    expect((await audit('?actor=edu.editor')).total).toBe(10);
    expect((await audit('?actor=EDUARDO')).total).toBe(10);
    const combined = await audit('?action=auth.login&actor=edu');
    expect(combined.total).toBe(2);
    expect(combined.items.every((entry) => entry.actorEmail === 'edu.editor@acme.test')).toBe(true);
    expect((await audit('?actor=ninguem')).total).toBe(0);
  });

  it('filtra por intervalo de datas civis', async () => {
    signIn('u_ana');
    const today = civilDate();
    const todayOnly = await audit(`?from=${today}&to=${today}`);
    expect(todayOnly.total).toBeGreaterThanOrEqual(1);
    expect(todayOnly.items.every((entry) => civilDate(new Date(entry.createdAt)) === today)).toBe(true);

    getDb().audit.unshift({
      id: 'a_novo',
      action: 'card.created',
      actorName: 'Ana Macuácua',
      actorEmail: 'ana.admin@acme.test',
      target: 'Novo cartão',
      companyId: 'co_acme',
      createdAt: new Date().toISOString(),
    });
    expect((await audit(`?from=${today}&to=${today}`)).total).toBe(todayOnly.total + 1);
    expect((await audit(`?to=2020-01-01`)).total).toBe(0);
    expect((await audit(`?from=2020-01-01`)).total).toBe(34);
  });

  it('recusa parâmetros fora do contrato', async () => {
    signIn('u_ana');
    for (const query of ['?action=inventada', '?from=2026-11-12&to=2026-11-01', '?from=12-11-2026', `?actor=${'a'.repeat(81)}`, '?pageSize=0']) {
      const response = await api('GET', `/api/audit${query}`);
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe('invalid_request');
    }
  });
});
