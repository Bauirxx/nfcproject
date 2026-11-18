// Cartões contra a base de dados real (só com DB_INTEGRATION=1). Inclui o isolamento entre empresas (regra 2):
// a empresa B recebe sempre 404 nos cartões da A. Os dados de teste são apagados no fim.
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { cardSchema } from '@nfc-business/shared/schemas';
import { isCardToken } from '@nfc-business/shared/validators';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { CardsController } from './cards.controller';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

const base = { mfaEnabled: true, mfaRequired: true, companyName: null, name: 'Editor', email: 'e@exemplo.test' };
const editorA: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000ca', role: 'company_editor', companyId: 'co_itc_a', mfaRequired: false };
const adminB: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000cb', role: 'company_admin', companyId: 'co_itc_b' };
const owner: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000cc', role: 'profile_owner', companyId: 'co_itc_a', mfaRequired: false };
const platform: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000cd', role: 'platform_admin', companyId: null };
const req = (user: SessionUser) => ({ user }) as unknown as AuthedRequest;

describe.runIf(enabled)('Cartões (base de dados real)', () => {
  const database = new DatabaseService(loadEnv({ ...process.env, NODE_ENV: 'test' }));
  const cards = new CardsController(database, { record: async () => undefined } as unknown as AuditService);
  const admin = { companyId: null, isPlatformAdmin: true };
  let cardId = '';

  async function cleanup() {
    await database.withContext(admin, async (db) => {
      await db.query(`delete from app.cards where company_id in ('co_itc_a', 'co_itc_b')`);
      await db.query(`delete from app.profiles where company_id in ('co_itc_a', 'co_itc_b')`);
      await db.query(`delete from app.companies where id in ('co_itc_a', 'co_itc_b')`);
    });
  }

  beforeAll(async () => {
    await cleanup();
    await database.withContext(admin, async (db) => {
      await db.query(`insert into app.companies (id, name, contact_email) values
        ('co_itc_a', 'ITC A', 'a@exemplo.test'), ('co_itc_b', 'ITC B', 'b@exemplo.test')`);
      await db.query(`insert into app.profiles (id, company_id, slug, display_name) values
        ('p_itc_a', 'co_itc_a', 'itc-perfil-a', 'Perfil A'), ('p_itc_b', 'co_itc_b', 'itc-perfil-b', 'Perfil B')`);
    });
  });

  afterAll(async () => {
    await cleanup();
    await database.onModuleDestroy();
  });

  it('cria um cartão inativo com token aleatório de 128 bits, no contrato', async () => {
    const card = await cards.create({ label: 'Receção' }, req(editorA));
    expect(cardSchema.safeParse(card).success).toBe(true);
    expect(card.status).toBe('inactive');
    expect(isCardToken(card.token)).toBe(true);
    const other = await cards.create({ label: 'Outro' }, req(editorA));
    expect(other.token).not.toBe(card.token);
    cardId = card.id;
  });

  it('não ativa sem perfil; liga o perfil, ativa, bloqueia e não sai de bloqueado', async () => {
    await expect(cards.activate(cardId, req(editorA))).rejects.toMatchObject({
      response: { error: { code: 'card_without_profile' } },
    });
    const linked = await cards.update(cardId, { profileId: 'p_itc_a', label: 'Receção principal' }, req(editorA));
    expect(linked).toMatchObject({ profileId: 'p_itc_a', profileName: 'Perfil A', label: 'Receção principal' });
    expect((await cards.activate(cardId, req(editorA))).status).toBe('active');
    await expect(cards.update(cardId, { profileId: null }, req(editorA))).rejects.toBeInstanceOf(ConflictException);
    expect((await cards.block(cardId, req(editorA))).status).toBe('blocked');
    await expect(cards.activate(cardId, req(editorA))).rejects.toMatchObject({
      response: { error: { code: 'invalid_transition' } },
    });
    const history = await cards.history(cardId, req(editorA));
    expect(history.items.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['created', 'profile_linked', 'updated', 'activated', 'blocked']),
    );
  });

  it('não liga um perfil de outra empresa (404)', async () => {
    const card = await cards.create({ label: 'Teste perfil alheio' }, req(editorA));
    await expect(cards.update(card.id, { profileId: 'p_itc_b' }, req(editorA))).rejects.toBeInstanceOf(NotFoundException);
    await expect(cards.create({ label: 'X', profileId: 'p_itc_b' }, req(editorA))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('isolamento: a empresa B recebe 404 em todas as operações sobre o cartão da A', async () => {
    await expect(cards.get(cardId, req(adminB))).rejects.toBeInstanceOf(NotFoundException);
    await expect(cards.history(cardId, req(adminB))).rejects.toBeInstanceOf(NotFoundException);
    await expect(cards.update(cardId, { label: 'Roubado' }, req(adminB))).rejects.toBeInstanceOf(NotFoundException);
    await expect(cards.deactivate(cardId, req(adminB))).rejects.toBeInstanceOf(NotFoundException);
    const listB = await cards.list({ page: 1, pageSize: 50 }, req(adminB));
    expect(listB.items.some((card) => card.id === cardId)).toBe(false);
    const listA = await cards.list({ page: 1, pageSize: 50, search: 'receção' }, req(editorA));
    expect(listA.items.map((card) => card.id)).toContain(cardId);
  });

  it('permissões: o dono de perfil não gere cartões; o platform_admin não tem empresa', async () => {
    await expect(cards.create({ label: 'Não' }, req(owner))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(cards.list({ page: 1, pageSize: 20 }, req(platform))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
