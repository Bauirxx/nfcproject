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

  it('fecha o pool', async () => {
    await service.onModuleDestroy();
  });
});
