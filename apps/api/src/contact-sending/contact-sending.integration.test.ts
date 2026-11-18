// Envio de contacto contra a base de dados real (só com DB_INTEGRATION=1). Canal WhatsApp (sem email): limites
// duráveis, evento contact_sent, perfil sem cartão ativo, isolamento entre empresas. Dados de teste apagados.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { contactShareSchema } from '@nfc-business/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { PublicCardService } from '../public/public-card.service';
import { ContactSendingService } from './contact-sending.service';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

const base = { mfaEnabled: false, mfaRequired: false, companyName: null, name: 'Teste', email: 't@exemplo.test' };
const editorA: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000fa', role: 'company_editor', companyId: 'co_its_a' };
const adminB: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000fb', role: 'company_admin', companyId: 'co_its_b', mfaEnabled: true, mfaRequired: true };
const share = (profileId: string) => ({
  profileId,
  channel: 'whatsapp' as const,
  recipient: { name: 'Cliente', phone: '+258841234567' },
  note: 'Até breve',
});

describe.runIf(enabled)('Envio de contacto (base de dados real)', () => {
  const env = loadEnv({ ...process.env, NODE_ENV: 'test' });
  const database = new DatabaseService(env);
  const sending = new ContactSendingService(database, new EmailService(env), new PublicCardService(database), env);
  const admin = { companyId: null, isPlatformAdmin: true };

  async function cleanup() {
    await database.withContext(admin, async (db) => {
      await db.query(`delete from app.contact_shares where company_id in ('co_its_a', 'co_its_b')`);
      await db.query(`delete from app.analytics_events where company_id in ('co_its_a', 'co_its_b')`);
      await db.query(`delete from app.cards where company_id in ('co_its_a', 'co_its_b')`);
      await db.query(`delete from app.profiles where company_id in ('co_its_a', 'co_its_b')`);
      await db.query(`delete from app.companies where id in ('co_its_a', 'co_its_b')`);
    });
  }

  beforeAll(async () => {
    await cleanup();
    await database.withContext(admin, async (db) => {
      await db.query(`insert into app.companies (id, name, contact_email) values
        ('co_its_a', 'ITS A', 'a@exemplo.test'), ('co_its_b', 'ITS B', 'b@exemplo.test')`);
      await db.query(`insert into app.profiles (id, company_id, slug, display_name) values
        ('p_its_a', 'co_its_a', 'its-perfil-a', 'Perfil A'), ('p_its_semcartao', 'co_its_a', 'its-sem-cartao', 'Sem cartão')`);
      await db.query(`insert into app.cards (id, company_id, label, token, status, profile_id) values
        ('c_its_a', 'co_its_a', 'Cartão A', 'ItsEnvioAAAAAAAAAAAAAA', 'active', 'p_its_a')`);
    });
  });

  afterAll(async () => {
    await cleanup();
    await database.onModuleDestroy();
  });

  it('regista o envio com o destinatário mascarado e o evento contact_sent', async () => {
    const { share: result } = await sending.send(editorA, share('p_its_a'));
    expect(contactShareSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ channel: 'whatsapp', profileName: 'Perfil A' });
    expect(result.recipientMasked).not.toContain('841234567');
    const events = await database.withContext(admin, (db) =>
      db.query<{ n: number }>(`select count(*)::int as n from app.analytics_events where card_id = 'c_its_a' and type = 'contact_sent'`),
    );
    expect(events.rows[0]?.n).toBe(1);
  });

  it('perfil sem cartão ativo: 409; perfil de outra empresa: 404', async () => {
    await expect(sending.send(editorA, share('p_its_semcartao'))).rejects.toBeInstanceOf(ConflictException);
    await expect(sending.send(adminB, share('p_its_a'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(sending.list(adminB, 1, 20, 'p_its_a')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('10 envios por hora por utilizador: o 11.º dá 429 com scope hour e Retry-After', async () => {
    for (let i = 1; i < 10; i += 1) await sending.send(editorA, share('p_its_a'));
    await expect(sending.send(editorA, share('p_its_a'))).rejects.toMatchObject({
      status: 429,
      response: { error: { code: 'rate_limited', scope: 'hour' }, retryAfter: expect.any(Number) },
    });
    const history = await sending.list(editorA, 1, 50, 'p_its_a');
    expect(history.total).toBe(10);
  });
});
