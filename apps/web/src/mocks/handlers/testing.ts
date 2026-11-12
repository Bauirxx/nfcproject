// Apoio aos testes dos handlers da API simulada: servidor MSW em Node, sessão e pedidos com token CSRF.
// Não é um ficheiro de testes (não termina em .test.ts); é importado por eles.
import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { getDb, resetDb, type DbUser } from '../db';
import { startSession } from '../domain';

/** Liga o servidor MSW com os handlers dados durante a suite e repõe os dados depois de cada teste. */
export function useMockServer(handlers: readonly HttpHandler[]): void {
  const server = setupServer(...handlers);
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => {
    resetDb();
  });
  afterAll(() => server.close());
}

/** Inicia sessão diretamente nos dados, sem passar pelo login. */
export function signIn(userId: string): DbUser {
  const db = getDb();
  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error(`utilizador desconhecido: ${userId}`);
  startSession(db, user);
  return user;
}

export function signOut(): void {
  getDb().cookies = { sessionId: null, accessExpiresAt: 0, mfaPendingUserId: null };
}

interface ApiOptions {
  /** `false` para enviar um pedido sem token CSRF. */
  csrf?: boolean;
  headers?: Record<string, string>;
}

/**
 * Pedido à API simulada como o cliente real o faria: JSON (ou `Blob` tal como está) e `X-CSRF-Token`
 * em tudo o que não seja GET. Uma `string` é enviada sem serializar, para testar corpos mal formados.
 */
export function api(method: string, path: string, body?: unknown, options: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    headers['Content-Type'] ??= body.type || 'application/octet-stream';
    payload = body;
  } else if (typeof body === 'string') {
    headers['Content-Type'] = 'application/json';
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (method !== 'GET' && options.csrf !== false) headers['X-CSRF-Token'] = getDb().csrfToken;
  return fetch(path, { method, headers, body: payload });
}

export async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

/** Lê o corpo JSON de uma resposta com o tipo esperado pelo teste. */
export function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
