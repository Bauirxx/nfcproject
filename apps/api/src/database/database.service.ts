// Acesso ao PostgreSQL do Supabase com o papel `app_backend` (CLAUDE.md, regra 3; ADR-0013).
// Cada operação corre numa transação com o contexto da sessão em `set_config(..., true)`:
// as políticas RLS leem `app.company_id` e `app.is_platform_admin`, e o valor morre com a transação,
// por isso uma ligação devolvida ao pool nunca leva o contexto de outro pedido.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { ENV, type Env } from '../config/env';

/** Contexto de autorização aplicado à base de dados. Vem sempre da sessão, nunca do cliente. */
export interface DbContext {
  companyId: string | null;
  isPlatformAdmin: boolean;
}

/** Subconjunto do cliente `pg` usado aqui (facilita os testes). */
export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>>;
}

interface PoolLike {
  connect(): Promise<Queryable & { release(error?: Error | boolean): void }>;
  end(): Promise<void>;
}

/** Locais onde procurar o certificado da CA do Supabase (local em apps/api, Render a partir da raiz). */
const CA_CANDIDATES = ['certs/supabase-ca.crt', 'apps/api/certs/supabase-ca.crt'];

/** Lê a CA do Supabase. Sem ela não há ligação: nunca se desliga a verificação TLS. */
export function loadSupabaseCa(cwd: string = process.cwd()): string {
  for (const candidate of CA_CANDIDATES) {
    const path = join(cwd, candidate);
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error('Certificado da CA do Supabase não encontrado (apps/api/certs/supabase-ca.crt).');
}

/**
 * Corre `work` numa transação com o contexto RLS da sessão.
 * Em erro faz rollback e devolve a ligação ao pool marcada como inválida.
 */
export async function runInContext<T>(
  pool: PoolLike,
  context: DbContext,
  work: (db: Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `select set_config('app.company_id', $1, true), set_config('app.is_platform_admin', $2, true)`,
      [context.companyId ?? '', context.isPlatformAdmin ? 'true' : 'false'],
    );
    const result = await work(client);
    await client.query('commit');
    client.release();
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
      client.release();
    } catch {
      client.release(true);
    }
    throw error;
  }
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: PoolLike | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Indica se a base de dados está configurada (em desenvolvimento pode faltar). */
  get configured(): boolean {
    return Boolean(this.env.DATABASE_URL);
  }

  private getPool(): PoolLike {
    if (!this.env.DATABASE_URL) throw new Error('DATABASE_URL não configurado.');
    this.pool ??= new pg.Pool({
      connectionString: this.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true, ca: loadSupabaseCa() },
      max: this.env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      // Nenhuma consulta pode prender uma ligação indefinidamente.
      statement_timeout: 10_000,
      application_name: 'nfc-business-api',
    });
    return this.pool;
  }

  /** Executa no contexto de uma empresa (ou do administrador da plataforma). */
  withContext<T>(context: DbContext, work: (db: Queryable) => Promise<T>): Promise<T> {
    return runInContext(this.getPool(), context, work);
  }

  /** Executa sem empresa (páginas públicas): só vê o que a RLS e as vistas públicas permitem. */
  withoutContext<T>(work: (db: Queryable) => Promise<T>): Promise<T> {
    return runInContext(this.getPool(), { companyId: null, isPlatformAdmin: false }, work);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }
}
