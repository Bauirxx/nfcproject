// Cliente da API. Sem dependências: faz parte do carregamento inicial da página pública (ADR-0003).
// Regras (docs/prompts/FRONTEND.md, «Segurança no frontend»): só /api na mesma origem, credentials include,
// X-CSRF-Token em todos os pedidos que alteram dados e tratamento central de 401, 403 e 429 (ADR-0005).
import { RATE_LIMIT_SCOPES, type RateLimitScope } from '@nfc-business/shared/constants';
import { getCsrfToken, setCsrfToken } from './csrf';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { emitUnauthorized } from './events';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface ApiRequestOptions {
  method?: HttpMethod | undefined;
  /** Objeto enviado como JSON, ou um `Blob` enviado tal como está (uploads). */
  body?: unknown;
  query?: QueryParams | undefined;
  signal?: AbortSignal | undefined;
  /** Deixa o pedido terminar mesmo que a página seja fechada (eventos da página pública). */
  keepalive?: boolean | undefined;
}

interface Attempt {
  csrfRetried: boolean;
  authRetried: boolean;
}

// Pedidos em que um 401 é a resposta final, e não um access token expirado que valha a pena renovar.
const NO_REFRESH_PATHS: ReadonlySet<string> = new Set([
  endpoints.auth.session,
  endpoints.auth.login,
  endpoints.auth.logout,
  endpoints.auth.refresh,
  endpoints.auth.mfaVerify,
  endpoints.auth.recover,
  endpoints.auth.recoverConfirm,
  endpoints.auth.inviteAccept,
]);

// Depois destes pedidos a sessão é outra: o token CSRF é pedido de novo.
const SESSION_CHANGING_PATHS: ReadonlySet<string> = new Set([
  endpoints.auth.login,
  endpoints.auth.logout,
  endpoints.auth.refresh,
  endpoints.auth.mfaVerify,
  endpoints.auth.inviteAccept,
]);

const ERROR_CODE_PATTERN = /^[a-z0-9_.-]{1,64}$/;

let csrfRequest: Promise<void> | null = null;
let refreshRequest: Promise<boolean> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildUrl(path: string, query: QueryParams | undefined): string {
  // Nunca URLs absolutos nem de outra origem, mesmo que o caminho venha de uma resposta da API.
  if (!path.startsWith('/api/') || path.includes('\\') || path.includes('/../')) {
    throw new Error('invalid_api_path');
  }
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  if (search === '') return path;
  return `${path}${path.includes('?') ? '&' : '?'}${search}`;
}

async function send(method: HttpMethod, url: string, options: ApiRequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.body instanceof Blob) {
    headers['Content-Type'] = options.body.type || 'application/octet-stream';
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET') {
    const token = getCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  try {
    return await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
      keepalive: options.keepalive,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'network_error');
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(response.status, 'invalid_response');
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'unknown_error';
  let scope: RateLimitScope | undefined;
  try {
    const body: unknown = await response.json();
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    if (error) {
      // Só códigos com o formato esperado: o texto do servidor nunca chega à interface.
      if (typeof error.code === 'string' && ERROR_CODE_PATTERN.test(error.code)) code = error.code;
      const rawScope = error.scope;
      scope = RATE_LIMIT_SCOPES.find((candidate) => candidate === rawScope);
    }
  } catch {
    // Corpo vazio ou que não é JSON: fica o código genérico.
  }
  const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
  return new ApiError(response.status, code, {
    scope,
    retryAfter: Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : undefined,
  });
}

function captureCsrfToken(session: unknown): void {
  if (isRecord(session) && typeof session.csrfToken === 'string' && session.csrfToken !== '') {
    setCsrfToken(session.csrfToken);
  }
}

/** Garante que há token CSRF antes de um pedido que altera dados. Pedidos em simultâneo partilham a consulta. */
async function ensureCsrfToken(): Promise<void> {
  if (getCsrfToken()) return;
  csrfRequest ??= request<unknown>(endpoints.auth.session, {}, { csrfRetried: false, authRetried: false })
    .then(() => undefined)
    .finally(() => {
      csrfRequest = null;
    });
  await csrfRequest;
}

async function request<T>(path: string, options: ApiRequestOptions, attempt: Attempt): Promise<T> {
  const method = options.method ?? 'GET';
  const url = buildUrl(path, options.query);
  if (method !== 'GET') await ensureCsrfToken();

  const response = await send(method, url, options);

  if (response.ok) {
    const data = await readBody(response);
    if (SESSION_CHANGING_PATHS.has(path)) setCsrfToken(null);
    if (path === endpoints.auth.session) captureCsrfToken(data);
    return data as T;
  }

  const error = await toApiError(response);

  if (error.status === 403 && error.code === 'csrf_invalid' && method !== 'GET' && !attempt.csrfRetried) {
    setCsrfToken(null);
    return request<T>(path, options, { ...attempt, csrfRetried: true });
  }

  if (error.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    if (!attempt.authRetried && (await refreshSession())) {
      return request<T>(path, options, { ...attempt, authRetried: true });
    }
    emitUnauthorized();
  }

  throw error;
}

/**
 * Renova a sessão com o refresh token (cookie HttpOnly restrito a /api/auth).
 * Pedidos em simultâneo partilham a mesma renovação. Devolve `false` se a sessão não pôde ser renovada.
 */
export function refreshSession(): Promise<boolean> {
  refreshRequest ??= request<void>(endpoints.auth.refresh, { method: 'POST' }, { csrfRetried: false, authRetried: true })
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

/**
 * Faz um pedido à API. `path` vem de `endpoints.ts`. Rejeita com `ApiError` em qualquer resposta
 * que não seja 2xx e quando não há resposta (`status` 0).
 */
export function apiFetch<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>(path, options, { csrfRetried: false, authRetried: false });
}
