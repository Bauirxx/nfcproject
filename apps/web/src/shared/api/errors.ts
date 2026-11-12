import type { RateLimitScope } from '@nfc-business/shared/constants';

/**
 * Erro de um pedido à API. `code` é um código estável (nunca texto do servidor): a interface
 * traduz-o numa mensagem genérica em `src/shared/i18n`. `status` é 0 quando não houve resposta.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Limite atingido numa resposta 429: por hora, por dia ou da empresa. */
  readonly scope: RateLimitScope | undefined;
  /** Segundos até poder repetir, do cabeçalho `Retry-After`. */
  readonly retryAfter: number | undefined;

  constructor(
    status: number,
    code: string,
    details: { scope?: RateLimitScope | undefined; retryAfter?: number | undefined } = {},
  ) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.scope = details.scope;
    this.retryAfter = details.retryAfter;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasStatus(error: unknown, status: number): boolean {
  return isApiError(error) && error.status === status;
}
