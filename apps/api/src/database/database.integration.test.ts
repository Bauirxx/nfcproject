// Teste contra a base de dados real (Supabase). Só corre com DB_INTEGRATION=1 e DATABASE_URL no `.env`:
//   DB_INTEGRATION=1 pnpm --filter @nfc-business/api test
// Não escreve dados: tudo corre em transações que terminam em rollback.
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { DatabaseService } from './database.service';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

describe.runIf(enabled)('DatabaseService (base de dados real)', () => {
  const service = new DatabaseService(loadEnv({ ...process.env, NODE_ENV: 'test' }));

  it('liga com o papel app_backend, sem superutilizador nem BYPASSRLS', async () => {
    const row = await service.withoutContext(async (db) => {
      const result = await db.query<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>(
        'select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user',
      );
      return result.rows[0];
    });
    expect(row).toEqual({ current_user: 'app_backend', rolsuper: false, rolbypassrls: false });
  });

  it('aplica o contexto só dentro da transação', async () => {
    const inside = await service.withContext({ companyId: 'c_teste', isPlatformAdmin: false }, async (db) => {
      const result = await db.query<{ company: string }>(`select current_setting('app.company_id', true) as company`);
      return result.rows[0]?.company;
    });
    expect(inside).toBe('c_teste');

    const after = await service.withoutContext(async (db) => {
      const result = await db.query<{ company: string }>(`select current_setting('app.company_id', true) as company`);
      return result.rows[0]?.company;
    });
    expect(after).toBe('');
  });

  it('a RLS impede escrever empresas sem ser administrador da plataforma', async () => {
    await expect(
      service.withContext({ companyId: 'c_teste', isPlatformAdmin: false }, async (db) => {
        await db.query(`insert into app.companies (id, name, contact_email) values ('c_rls_teste', 'Teste RLS', 'rls@exemplo.test')`);
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it('não tem acesso ao schema auth do Supabase', async () => {
    await expect(service.withoutContext((db) => db.query('select 1 from auth.users limit 1'))).rejects.toThrow(
      /permission denied/,
    );
  });

  // Migração 0002.
  it('cria as tabelas novas com RLS e as políticas só para o app_backend', async () => {
    const rows = await service.withoutContext(async (db) => {
      const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'app' and c.relkind = 'r' order by 1`,
      );
      const policies = await db.query<{ policyname: string; roles: string[] }>(
        `select policyname, roles::text[] as roles from pg_policies where schemaname = 'app'`,
      );
      return { tables: tables.rows, policies: policies.rows };
    });
    expect(rows.tables.map((t) => t.relname)).toEqual(
      expect.arrayContaining(['analytics_events', 'audit_logs', 'contact_shares', 'email_suppressions']),
    );
    expect(rows.tables.every((t) => t.relrowsecurity)).toBe(true);
    expect(rows.policies.length).toBeGreaterThan(0);
    expect(rows.policies.every((p) => p.roles.length === 1 && p.roles[0] === 'app_backend')).toBe(true);
  });

  it('audit_logs é append-only para o app_backend', async () => {
    await expect(
      service.withContext({ companyId: null, isPlatformAdmin: true }, (db) =>
        db.query(`update app.audit_logs set target = 'x' where false`),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      service.withContext({ companyId: null, isPlatformAdmin: true }, (db) =>
        db.query(`delete from app.audit_logs where false`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('a vista public_cards lê-se sem contexto e não aceita escrita', async () => {
    const count = await service.withoutContext(async (db) => {
      const result = await db.query<{ n: number }>('select count(*)::int as n from app.public_cards');
      return result.rows[0]?.n;
    });
    expect(typeof count).toBe('number');
    // Um `delete` numa vista com junção falha antes da verificação de privilégios; confirma-se o privilégio.
    const privileges = await service.withoutContext(async (db) => {
      const result = await db.query<Record<string, boolean>>(
        `select has_table_privilege('app.public_cards', 'select') as sel,
                has_table_privilege('app.public_cards', 'insert,update,delete') as write,
                has_table_privilege('app.audit_logs', 'update,delete,truncate') as audit_write`,
      );
      return result.rows[0];
    });
    expect(privileges).toEqual({ sel: true, write: false, audit_write: false });
  });

  it('public_cards só mostra cartões ativos e só os campos públicos (dados de teste com rollback)', async () => {
    const rollback = new Error('rollback de teste');
    let seen: { tokens: string[]; row: Record<string, unknown> | undefined } | undefined;
    await expect(
      service.withContext({ companyId: null, isPlatformAdmin: true }, async (db) => {
        await db.query(`insert into app.companies (id, name, contact_email) values ('co_it', 'IT', 'it@exemplo.test')`);
        await db.query(
          `insert into app.profiles (id, company_id, slug, display_name, title, bio, visibility, contacts)
           values ('p_it', 'co_it', 'perfil-it', 'Perfil IT', 'Cargo privado', 'Bio pública',
                   '{"title":false,"company":true,"bio":true,"photo":true}',
                   '[{"id":"k1","type":"phone","value":"+258841234567","isPublic":true},
                     {"id":"k2","type":"email","value":"privado@exemplo.test","isPublic":false}]')`,
        );
        await db.query(
          `insert into app.cards (id, company_id, label, token, status, profile_id) values
             ('c_it_a', 'co_it', 'A', 'ItAtivoAAAAAAAAAAAAAAA', 'active',  'p_it'),
             ('c_it_b', 'co_it', 'B', 'ItBloqueadoBBBBBBBBBBB', 'blocked', 'p_it'),
             ('c_it_l', 'co_it', 'L', 'ItPerdidoLLLLLLLLLLLLL', 'lost',    'p_it')`,
        );
        const result = await db.query<Record<string, unknown>>(
          `select * from app.public_cards where company_id = 'co_it' order by token`,
        );
        seen = { tokens: result.rows.map((r) => String(r.token)), row: result.rows[0] };
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    expect(seen?.tokens).toEqual(['ItAtivoAAAAAAAAAAAAAAA']);
    expect(seen?.row).toMatchObject({ title: null, bio: 'Bio pública', slug: 'perfil-it' });
    expect(JSON.stringify(seen?.row?.contacts)).not.toContain('privado@exemplo.test');
    expect(JSON.stringify(seen?.row?.contacts)).not.toContain('"id"');

    // O rollback não deixou nada para trás.
    const left = await service.withContext({ companyId: null, isPlatformAdmin: true }, async (db) => {
      const result = await db.query<{ n: number }>(`select count(*)::int as n from app.companies where id = 'co_it'`);
      return result.rows[0]?.n;
    });
    expect(left).toBe(0);
  });

  it('o app_backend não pode correr a anonimização (só o pg_cron)', async () => {
    await expect(
      service.withoutContext((db) => db.query('select app.anonymize_old_contact_shares()')),
    ).rejects.toThrow(/permission denied/);
  });

  it('fecha o pool', async () => {
    await service.onModuleDestroy();
  });
});
