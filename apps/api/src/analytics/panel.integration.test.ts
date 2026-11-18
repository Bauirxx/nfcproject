// Endpoints do painel contra a base de dados real (só com DB_INTEGRATION=1). Cria duas empresas de teste,
// verifica os totais e o isolamento entre empresas (regra 2) e apaga tudo no fim.
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { AuditController } from '../audit/audit.controller';
import { CompaniesController } from '../companies/companies.controller';
import type { MembersService } from '../members/members.service';
import type { UploadsService } from '../uploads/uploads.service';
import type { AuditService } from '../audit/audit.service';
import { AnalyticsService, REPORT_TIME_ZONE } from './analytics.service';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

const base = { mfaEnabled: true, mfaRequired: true, companyName: null, name: 'Teste', email: 't@exemplo.test' };
const platformAdmin: SessionUser = { ...base, id: '00000000-0000-0000-0000-000000000001', role: 'platform_admin', companyId: null };
const adminA: SessionUser = { ...base, id: '00000000-0000-0000-0000-00000000000a', role: 'company_admin', companyId: 'co_it_a' };
const adminB: SessionUser = { ...base, id: '00000000-0000-0000-0000-00000000000b', role: 'company_admin', companyId: 'co_it_b' };
const req = (user: SessionUser) => ({ user }) as unknown as AuthedRequest;

describe.runIf(enabled)('Painel (base de dados real)', () => {
  const database = new DatabaseService(loadEnv({ ...process.env, NODE_ENV: 'test' }));
  const analytics = new AnalyticsService(database);
  const audit = new AuditController(database);
  const companies = new CompaniesController(
    database,
    { record: async () => undefined } as unknown as AuditService,
    {} as unknown as MembersService,
    {} as unknown as UploadsService,
  );
  const admin = { companyId: null, isPlatformAdmin: true };
  let today = '';

  async function cleanup() {
    await database.withContext(admin, async (db) => {
      await db.query(`delete from app.analytics_events where company_id in ('co_it_a', 'co_it_b')`);
      await db.query(`delete from app.cards where company_id in ('co_it_a', 'co_it_b')`);
      await db.query(`delete from app.profiles where company_id in ('co_it_a', 'co_it_b')`);
      await db.query(`delete from app.companies where id in ('co_it_a', 'co_it_b')`);
    });
  }

  beforeAll(async () => {
    await cleanup();
    await database.withContext(admin, async (db) => {
      today = (await db.query<{ d: string }>(`select to_char((now() at time zone $1)::date, 'YYYY-MM-DD') as d`, [REPORT_TIME_ZONE])).rows[0]!.d;
      await db.query(`insert into app.companies (id, name, contact_email) values
        ('co_it_a', 'IT Empresa A', 'a@exemplo.test'), ('co_it_b', 'IT Empresa B', 'b@exemplo.test')`);
      await db.query(`insert into app.profiles (id, company_id, slug, display_name) values
        ('p_it_a', 'co_it_a', 'it-perfil-a', 'Perfil A'), ('p_it_b', 'co_it_b', 'it-perfil-b', 'Perfil B')`);
      await db.query(`insert into app.cards (id, company_id, label, token, status, profile_id) values
        ('c_it_a', 'co_it_a', 'Cartão A', 'ItPainelAAAAAAAAAAAAAA', 'active', 'p_it_a'),
        ('c_it_b', 'co_it_b', 'Cartão B', 'ItPainelBBBBBBBBBBBBBB', 'active', 'p_it_b')`);
      await db.query(`insert into app.analytics_events (company_id, card_id, profile_id, type) values
        ('co_it_a', 'c_it_a', 'p_it_a', 'view'), ('co_it_a', 'c_it_a', 'p_it_a', 'view'),
        ('co_it_a', 'c_it_a', 'p_it_a', 'whatsapp_click'), ('co_it_b', 'c_it_b', 'p_it_b', 'view')`);
    });
  });

  afterAll(async () => {
    await cleanup();
    await database.onModuleDestroy();
  });

  it('o administrador da empresa A só vê os cartões e eventos da A', async () => {
    const summary = await analytics.summary(adminA, { from: today, to: today });
    expect(summary.byCard.map((card) => card.cardId)).toEqual(['c_it_a']);
    expect(summary.totals).toMatchObject({ views: 2, clicks: 1 });
    expect(summary.byCompany).toBeUndefined();
  });

  it('pedir o cartão da empresa B a partir da A dá 404', async () => {
    await expect(analytics.summary(adminA, { from: today, to: today, cardId: 'c_it_b' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const own = await analytics.summary(adminB, { from: today, to: today, cardId: 'c_it_b' });
    expect(own.totals.views).toBe(1);
  });

  it('o platform_admin filtra por empresa e recebe o total por empresa', async () => {
    const summary = await analytics.summary(platformAdmin, { from: today, to: today, companyId: 'co_it_a' });
    expect(summary.byCard.map((card) => card.cardId)).toEqual(['c_it_a']);
    expect(summary.byCompany).toEqual([
      expect.objectContaining({ companyId: 'co_it_a', companyName: 'IT Empresa A', views: 2, clicks: 1 }),
    ]);
  });

  it('empresas: o platform_admin lê a lista e o detalhe; um id inexistente dá 404', async () => {
    const list = await companies.list(req(platformAdmin));
    expect(list.items.map((company) => company.id)).toEqual(expect.arrayContaining(['co_it_a', 'co_it_b']));
    const one = await companies.get('co_it_a', req(platformAdmin));
    expect(one).toMatchObject({ name: 'IT Empresa A', cardsCount: 1, membersCount: 0 });
    await expect(companies.get('co_nao_existe', req(platformAdmin))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('auditoria: a empresa A não vê entradas de outras empresas nem as globais', async () => {
    const page = await audit.list({ page: 1, pageSize: 50 }, req(adminA));
    expect(page.items.every((entry) => entry.companyName === 'IT Empresa A')).toBe(true);
  });
});
