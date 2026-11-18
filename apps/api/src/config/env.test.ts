import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('aplica valores por defeito seguros', () => {
    const env = loadEnv({});
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('converte a porta e aceita o Supabase opcional em desenvolvimento', () => {
    const env = loadEnv({ PORT: '8080', SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'chave' });
    expect(env.PORT).toBe(8080);
    expect(env.SUPABASE_URL).toBe('https://proj.supabase.co');
  });

  it('normaliza o URL do Supabase para a origem (tolera caminho colado)', () => {
    const env = loadEnv({ SUPABASE_URL: 'https://proj.supabase.co/rest/v1/', SUPABASE_ANON_KEY: 'chave' });
    expect(env.SUPABASE_URL).toBe('https://proj.supabase.co');
  });

  it('recusa valores inválidos', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/ambiente inválida/);
    expect(() => loadEnv({ PORT: '0' })).toThrow(/ambiente inválida/);
    expect(() => loadEnv({ SUPABASE_URL: 'não-é-url' })).toThrow(/ambiente inválida/);
  });

  it('exige o Supabase e a base de dados em produção', () => {
    const supabase = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'chave' };
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/produção/);
    expect(() => loadEnv({ NODE_ENV: 'production', ...supabase })).toThrow(/DATABASE_URL/);
    expect(
      loadEnv({ NODE_ENV: 'production', ...supabase, DATABASE_URL: 'postgresql://app_backend.x:p@host:5432/postgres' })
        .NODE_ENV,
    ).toBe('production');
  });

  it('só aceita URLs PostgreSQL na base de dados', () => {
    expect(() => loadEnv({ DATABASE_URL: 'https://host/db' })).toThrow(/DATABASE_URL/);
    expect(loadEnv({ DATABASE_URL: 'postgres://u:p@host:5432/db' }).DATABASE_POOL_MAX).toBe(5);
  });
});
