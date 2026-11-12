// Apoio aos testes dos handlers da API simulada: servidor MSW em Node, sessão e pedidos com token CSRF.
// Não é um ficheiro de testes (não termina em .test.ts); é importado por eles.
import type { HttpHandler } from 'msw';
import type { UploadMimeType, UploadPurpose } from '@nfc-business/shared/constants';
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

export type ImageKind = 'png' | 'jpeg' | 'webp' | 'svg';

const IMAGE_SIGNATURES: Record<ImageKind, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  svg: [...new TextEncoder().encode('<svg xmlns="')],
};

export const IMAGE_MIME: Record<Exclude<ImageKind, 'svg'>, UploadMimeType> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Bytes com a assinatura de uma imagem, para os testes de uploads (a API simulada só verifica o cabeçalho). */
export function imageBytes(kind: ImageKind, size: number = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(Math.max(size, 16));
  bytes.set(IMAGE_SIGNATURES[kind]);
  return bytes;
}

/** Pede o URL assinado e envia uma imagem fictícia; devolve o `fileId` pronto a usar noutro pedido. */
export async function uploadImage(purpose: UploadPurpose, kind: Exclude<ImageKind, 'svg'> = 'png'): Promise<string> {
  const contentType = IMAGE_MIME[kind];
  const bytes = imageBytes(kind);
  const sign = await api('POST', '/api/uploads/sign', { purpose, contentType, size: bytes.length });
  if (sign.status !== 200) throw new Error(`sign falhou com ${sign.status}`);
  const { fileId, uploadUrl } = await readJson<{ fileId: string; uploadUrl: string }>(sign);
  const put = await api('PUT', uploadUrl, new Blob([bytes], { type: contentType }));
  if (put.status !== 204) throw new Error(`upload falhou com ${put.status}`);
  return fileId;
}
