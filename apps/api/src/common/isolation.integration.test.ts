// Isolamento entre empresas contra a base de dados real (CLAUDE.md, regra 2; critério de saída da fase 2).
// Só com DB_INTEGRATION=1 e a chave service_role no `.env` (cria duas contas de teste no Supabase Auth, sem email).
//
// 1. RLS sozinha: no contexto da empresa A, consultas SEM filtro por empresa não veem nada das outras empresas e
//    escritas sobre linhas da empresa B não afetam nada. Protege contra um endpoint futuro que esqueça o filtro.
// 2. Membros, empresas e uploads: a empresa A a aceder a recursos da empresa B recebe 404 (ou 403 pelo papel),
//    sem efeitos no Supabase Auth.
// Os outros módulos têm os seus testes de isolamento: panel (estatísticas, auditoria), cards, profiles,
// contact-sending.
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import { CompaniesController } from '../companies/companies.controller';
import { loadEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { MembersController } from '../members/members.controller';
import { MembersService } from '../members/members.service';
import type { SupabaseAdminService } from '../supabase/supabase-admin.service';
import type { ImageProcessorService } from '../uploads/image-processor.service';
import { UploadsService } from '../uploads/uploads.service';
import type { AuthedRequest } from './auth.guard';
import type { SessionUser } from './session-user';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

const A = 'co_iso_a';
const B = 'co_iso_b';
const base = { mfaEnabled: true, mfaRequired: true, companyName: null, name: 'Teste', email: 't@exemplo.test' };
const adminA: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000001aa', role: 'company_admin', companyId: A };
const adminB: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000001bb', role: 'company_admin', companyId: B };
const req = (user: SessionUser) => ({ user }) as unknown as AuthedRequest;
const contextA = { companyId: A, isPlatformAdmin: false };
const platform = { companyId: null, isPlatformAdmin: true };

/** Tabelas com dados por empresa e a coluna que as liga à empresa. */
const TENANT_TABLES: Array<[table: string, column: string]> = [
  ['companies', 'id'],
  ['users', 'company_id'],
  ['profiles', 'company_id'],
  ['cards', 'company_id'],
  ['contact_shares', 'company_id'],
  ['analytics_events', 'company_id'],
  ['uploads', 'company_id'],
  ['audit_logs', 'company_id'],
];

describe.runIf(enabled && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY))('Isolamento entre empresas (base de dados real)', () => {
  const env = loadEnv({ ...process.env, NODE_ENV: 'test' });
  const database = new DatabaseService(env);
  // Só o teste cria e apaga as contas temporárias; a aplicação usa a service_role apenas no SupabaseAdminService.
  // Criado no beforeAll: o corpo do describe corre mesmo quando o teste é saltado (CI sem `.env`).
  let authAdmin: ReturnType<typeof createClient>['auth']['admin'];
  const supabaseAdmin = {
    configured: true,
    setRole: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
  };
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const members = new MembersController(
    database,
    new MembersService(supabaseAdmin as unknown as SupabaseAdminService, env),
    supabaseAdmin as unknown as SupabaseAdminService,
    audit,
  );
  const companies = new CompaniesController(database, audit, {} as MembersService, {} as UploadsService);
  const uploads = new UploadsService(database, supabaseAdmin as unknown as SupabaseAdminService, {} as ImageProcessorService, env);
  const authUsers: string[] = [];
  let memberA = '';
  let memberB = '';

  async function cleanupRows() {
    await database.withContext(platform, async (db) => {
      await db.query(`delete from app.analytics_events where company_id in ($1, $2)`, [A, B]);
      await db.query(`delete from app.contact_shares where company_id in ($1, $2)`, [A, B]);
      await db.query(`delete from app.cards where company_id in ($1, $2)`, [A, B]);
      await db.query(`delete from app.profiles where company_id in ($1, $2)`, [A, B]);
      // Os uploads e os membros espelhados saem em cascata / ficam sem empresa ao apagar as empresas.
      await db.query(`delete from app.companies where id in ($1, $2)`, [A, B]);
    });
  }

  async function createAuthUser(email: string): Promise<string> {
    const { data, error } = await authAdmin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw new Error(`Não foi possível criar a conta de teste: ${error?.message ?? 'sem utilizador'}`);
    authUsers.push(data.user.id);
    return data.user.id;
  }

  beforeAll(async () => {
    authAdmin = createClient(env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.admin;
    await cleanupRows();
    memberA = await createAuthUser(`iso-a-${Date.now()}@exemplo.test`);
    memberB = await createAuthUser(`iso-b-${Date.now()}@exemplo.test`);
    await database.withContext(platform, async (db) => {
      await db.query(`insert into app.companies (id, name, contact_email) values ($1, 'ISO A', 'a@exemplo.test'), ($2, 'ISO B', 'b@exemplo.test')`, [A, B]);
      await db.query(
        `insert into app.users (id, email, role, company_id, status) values
           ($1, 'iso-a@exemplo.test', 'company_editor', $3, 'active'), ($2, 'iso-b@exemplo.test', 'company_editor', $4, 'active')`,
        [memberA, memberB, A, B],
      );
      await db.query(`insert into app.profiles (id, company_id, slug, display_name) values
        ('p_iso_a', $1, 'iso-perfil-a', 'Perfil A'), ('p_iso_b', $2, 'iso-perfil-b', 'Perfil B')`, [A, B]);
      await db.query(`insert into app.cards (id, company_id, label, token, status, profile_id) values
        ('c_iso_a', $1, 'Cartão A', 'IsoCardAAAAAAAAAAAAAAA', 'active', 'p_iso_a'),
        ('c_iso_b', $2, 'Cartão B', 'IsoCardBBBBBBBBBBBBBBB', 'active', 'p_iso_b')`, [A, B]);
      await db.query(`insert into app.analytics_events (company_id, card_id, profile_id, type) values ($1, 'c_iso_b', 'p_iso_b', 'view')`, [B]);
      await db.query(
        `insert into app.contact_shares (company_id, profile_id, sender_user_id, channel, recipient_phone, recipient_masked)
         values ($1, 'p_iso_b', $2, 'whatsapp', '+258841234567', '+258 ••• •• 67')`,
        [B, memberB],
      );
      await db.query(
        `insert into app.uploads (id, company_id, user_id, purpose, content_type, size, status, public_path) values
           ('f_iso_b_ready', $1, $2, 'profile_photo', 'image/webp', 100, 'ready', 'profile_photo/iso-b.webp'),
           ('f_iso_b_pending', $1, $2, 'profile_photo', 'image/jpeg', 100, 'pending', null)`,
        [B, adminB.id],
      );
    });
  });

  afterAll(async () => {
    for (const id of authUsers) await authAdmin.deleteUser(id).catch(() => undefined);
    await cleanupRows();
    await database.onModuleDestroy();
  });

  describe('RLS sozinha (consultas sem filtro por empresa)', () => {
    it.each(TENANT_TABLES)('%s: no contexto da empresa A não aparece nenhuma linha de outra empresa', async (table, column) => {
      const visible = await database.withContext(contextA, (db) =>
        db.query<{ n: number }>(`select count(*)::int as n from app.${table} where ${column} is distinct from $1`, [A]),
      );
      expect(visible.rows[0]?.n).toBe(0);
    });

    it('a empresa B existe mesmo (o zero acima não é por falta de dados)', async () => {
      const counts = await database.withContext(platform, (db) =>
        db.query<{ t: string; n: number }>(
          `select 'profiles' t, count(*)::int n from app.profiles where company_id = $1
           union all select 'cards', count(*)::int from app.cards where company_id = $1
           union all select 'users', count(*)::int from app.users where company_id = $1
           union all select 'contact_shares', count(*)::int from app.contact_shares where company_id = $1
           union all select 'uploads', count(*)::int from app.uploads where company_id = $1`,
          [B],
        ),
      );
      expect(counts.rows.every((row) => row.n > 0)).toBe(true);
    });

    it('escritas da empresa A sobre linhas da B não afetam nada; inserir na B é recusado', async () => {
      const affected = await database.withContext(contextA, async (db) => [
        (await db.query(`update app.profiles set display_name = 'invadido' where id = 'p_iso_b'`)).rowCount,
        (await db.query(`update app.cards set status = 'blocked' where id = 'c_iso_b'`)).rowCount,
        (await db.query(`delete from app.cards where id = 'c_iso_b'`)).rowCount,
        (await db.query(`update app.users set role = 'company_admin' where id = $1`, [memberB])).rowCount,
        (await db.query(`update app.companies set name = 'invadido' where id = $1`, [B])).rowCount,
        (await db.query(`update app.uploads set status = 'consumed' where id = 'f_iso_b_ready'`)).rowCount,
      ]);
      expect(affected).toEqual([0, 0, 0, 0, 0, 0]);

      await expect(
        database.withContext(contextA, (db) =>
          db.query(`insert into app.profiles (id, company_id, slug, display_name) values ('p_iso_x', $1, 'iso-x', 'X')`, [B]),
        ),
      ).rejects.toThrow(/row-level security/);
      // Criar empresas é só do platform_admin, mesmo dentro de uma empresa.
      await expect(
        database.withContext(contextA, (db) => db.query(`insert into app.companies (id, name, contact_email) values ('co_iso_x', 'X', 'x@exemplo.test')`)),
      ).rejects.toThrow(/row-level security/);

      const intact = await database.withContext(platform, (db) =>
        db.query<{ name: string; status: string }>(
          `select p.display_name as name, c.status from app.profiles p join app.cards c on c.profile_id = p.id where p.id = 'p_iso_b'`,
        ),
      );
      expect(intact.rows[0]).toEqual({ name: 'Perfil B', status: 'active' });
    });
  });

  describe('membros', () => {
    it('a empresa A só lista os seus membros', async () => {
      const list = await members.list(req(adminA));
      expect(list.items.map((member) => member.id)).toEqual([memberA]);
    });

    it('mudar o papel ou remover um membro da B dá 404, sem tocar no Supabase Auth', async () => {
      await expect(members.changeRole(memberB, { role: 'company_admin' }, req(adminA))).rejects.toBeInstanceOf(NotFoundException);
      await expect(members.remove(memberB, req(adminA))).rejects.toBeInstanceOf(NotFoundException);
      expect(supabaseAdmin.setRole).not.toHaveBeenCalled();
      expect(supabaseAdmin.deleteUser).not.toHaveBeenCalled();
    });

    it('o mesmo pedido na própria empresa funciona (o 404 acima não é um erro geral)', async () => {
      const updated = await members.changeRole(memberA, { role: 'profile_owner' }, req(adminA));
      expect(updated).toMatchObject({ id: memberA, role: 'profile_owner' });
      expect(supabaseAdmin.setRole).toHaveBeenCalledWith(memberA, 'profile_owner', A);
    });
  });

  describe('empresas', () => {
    it('um company_admin não lê nem altera empresas, nem a sua nem as outras (403 pelo papel)', async () => {
      await expect(companies.list(req(adminA))).rejects.toBeInstanceOf(ForbiddenException);
      await expect(companies.get(B, req(adminA))).rejects.toBeInstanceOf(ForbiddenException);
      await expect(companies.update(B, { name: 'invadido' }, req(adminA))).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('uploads', () => {
    it('a empresa A não envia para um pedido da B (404) nem consome um ficheiro da B (422, como um id desconhecido)', async () => {
      await expect(uploads.receive(adminA, 'f_iso_b_pending', new Uint8Array(100), 'image/jpeg')).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        database.withContext(contextA, (db) => uploads.consume(db, adminA, 'f_iso_b_ready', 'profile_photo')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      // Mesmo com o id do dono, fora do contexto da B a RLS não deixa ver a linha.
      await expect(
        database.withContext(contextA, (db) => uploads.consume(db, adminB, 'f_iso_b_ready', 'profile_photo')),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      const own = await database.withContext({ companyId: B, isPlatformAdmin: false }, (db) =>
        uploads.consume(db, adminB, 'f_iso_b_ready', 'profile_photo'),
      );
      expect(own).toMatch(/\/public-images\/profile_photo\/iso-b\.webp$/);
    });
  });
});
