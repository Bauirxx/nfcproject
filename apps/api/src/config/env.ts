// Configuração do backend lida do ambiente (CLAUDE.md, regra 9: nenhum segredo no código).
// Validada no arranque; uma configuração inválida impede a aplicação de subir.
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /**
   * URL do projeto Supabase. Obrigatório em produção; vem de um `.env` fora do repositório.
   * Normalizado para a origem, para tolerar valores colados com caminho (por exemplo `/rest/v1/`).
   */
  SUPABASE_URL: z
    .string()
    .url()
    .transform((value) => new URL(value).origin)
    .optional(),
  /** Chave pública (anon/publishable) do Supabase, usada pelo backend ao chamar o Supabase Auth. */
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /**
   * Ligação PostgreSQL com o papel `app_backend` (sem BYPASSRLS), pelo Session pooler do Supabase (ADR-0013).
   * Segredo: só no `.env` local ou nas variáveis do Render.
   */
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => /^postgres(ql)?:\/\//.test(value), 'postgres_url')
    .optional(),
  /** Máximo de ligações do pool; o pooler do Supabase também limita. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
});

export type Env = z.infer<typeof envSchema>;

/** Lê e valida o ambiente. Lança com a lista de campos em falta; em produção o Supabase é obrigatório. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || '(raiz)').join(', ');
    throw new Error(`Configuração de ambiente inválida: ${fields}.`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production' && (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.DATABASE_URL)) {
    throw new Error(
      'Configuração de ambiente inválida: SUPABASE_URL, SUPABASE_ANON_KEY e DATABASE_URL são obrigatórios em produção.',
    );
  }
  return env;
}

/** Símbolo de injeção da configuração validada. */
export const ENV = Symbol('ENV');
