import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../config/env';
import { DatabaseService, loadSupabaseCa, runInContext } from './database.service';

function fakePool(failOn?: string) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const release = vi.fn();
  const client = {
    query: vi.fn(async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      if (failOn && text.includes(failOn)) throw new Error('falhou');
      return { rows: [], rowCount: 0 } as never;
    }),
    release,
  };
  return { pool: { connect: vi.fn(async () => client), end: vi.fn(async () => {}) }, calls, release };
}

describe('runInContext', () => {
  it('define o contexto da sessão dentro da transação e faz commit', async () => {
    const { pool, calls, release } = fakePool();
    const result = await runInContext(pool, { companyId: 'c_acme', isPlatformAdmin: false }, async (db) => {
      await db.query('select 1');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls.map((call) => call.text.split(' ')[0])).toEqual(['begin', 'select', 'select', 'commit']);
    // `true` no terceiro argumento: o valor é local à transação e não passa para o próximo pedido.
    expect(calls[1]?.text).toContain("set_config('app.company_id', $1, true)");
    expect(calls[1]?.values).toEqual(['c_acme', 'false']);
    expect(release).toHaveBeenCalledWith();
  });

  it('sem empresa usa um valor vazio que não corresponde a nenhuma linha', async () => {
    const { pool, calls } = fakePool();
    await runInContext(pool, { companyId: null, isPlatformAdmin: false }, async () => undefined);
    expect(calls[1]?.values).toEqual(['', 'false']);
  });

  it('marca o administrador da plataforma', async () => {
    const { pool, calls } = fakePool();
    await runInContext(pool, { companyId: null, isPlatformAdmin: true }, async () => undefined);
    expect(calls[1]?.values).toEqual(['', 'true']);
  });

  it('faz rollback e propaga o erro do trabalho', async () => {
    const { pool, calls, release } = fakePool('insert');
    await expect(
      runInContext(pool, { companyId: 'c_acme', isPlatformAdmin: false }, async (db) => {
        await db.query('insert into app.cards values (1)');
      }),
    ).rejects.toThrow('falhou');
    expect(calls.at(-1)?.text).toBe('rollback');
    expect(release).toHaveBeenCalledWith();
  });

  it('descarta a ligação quando o próprio rollback falha', async () => {
    const { pool, release } = fakePool('rollback');
    await expect(
      runInContext(pool, { companyId: 'c', isPlatformAdmin: false }, async () => {
        throw new Error('trabalho');
      }),
    ).rejects.toThrow('trabalho');
    expect(release).toHaveBeenCalledWith(true);
  });
});

describe('loadSupabaseCa', () => {
  it('encontra o certificado a partir de apps/api ou da raiz do repositório', () => {
    const root = mkdtempSync(join(tmpdir(), 'nfc-ca-'));
    mkdirSync(join(root, 'apps/api/certs'), { recursive: true });
    writeFileSync(join(root, 'apps/api/certs/supabase-ca.crt'), 'CERT');
    expect(loadSupabaseCa(root)).toBe('CERT');
    expect(loadSupabaseCa(join(root, 'apps/api'))).toBe('CERT');
  });

  it('falha sem certificado (nunca desliga a verificação TLS)', () => {
    expect(() => loadSupabaseCa(mkdtempSync(join(tmpdir(), 'nfc-noca-')))).toThrow(/CA do Supabase/);
  });
});

describe('DatabaseService', () => {
  it('recusa operar sem DATABASE_URL', () => {
    const service = new DatabaseService(loadEnv({ NODE_ENV: 'test' }));
    expect(service.configured).toBe(false);
    expect(() => service.withoutContext(async () => 1)).toThrow(/DATABASE_URL/);
  });
});
