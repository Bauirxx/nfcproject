import type { z } from 'zod';
import { apiFetch, type ApiRequestOptions } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';

/**
 * Pedido à API com a resposta validada pelo schema partilhado (só no painel: a página pública não carrega o Zod).
 * Uma resposta fora do contrato é tratada como erro, em vez de chegar aos componentes.
 */
export async function apiParsed<S extends z.ZodType>(
  schema: S,
  path: string,
  options?: ApiRequestOptions,
): Promise<z.output<S>> {
  const data = await apiFetch(path, options);
  const result = schema.safeParse(data);
  if (!result.success) throw new ApiError(200, 'invalid_response');
  return result.data;
}
