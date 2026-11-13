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

  it('exige o Supabase em produção', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/produção/);
    expect(
      loadEnv({ NODE_ENV: 'production', SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'chave' }).NODE_ENV,
    ).toBe('production');
  });
});
