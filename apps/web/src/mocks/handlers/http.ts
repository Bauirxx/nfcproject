// Mecânica comum dos handlers da API simulada: sincronização dos dados, CSRF, sessão, validação e erros.
import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import type { z } from 'zod';
import type { RateLimitScope } from '@nfc-business/shared/constants';
import { can, requiresMfa, type Permission } from '@nfc-business/shared/permissions';
import type { Paginated } from '@nfc-business/shared/schemas';
import { getDb, loadDb, saveDb, type DbUser, type MockDb } from '../db';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteContext {
  request: Request;
  url: URL;
  db: MockDb;
  /** Parâmetro do caminho, por exemplo `:id`. */
  param: (name: string) => string;
}

type Resolver = (context: RouteContext) => Response | Promise<Response>;

// Só em desenvolvimento, para que os estados de carregamento se vejam.
const LATENCY_MS = import.meta.env.MODE === 'development' ? 150 : 0;

/** Erro que interrompe um handler com uma resposta HTTP. */
export class HttpFailure extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super('http_failure');
    this.response = response;
  }
}

export function json(data: unknown, status: number = 200): Response {
  return HttpResponse.json(data as Record<string, unknown>, { status });
}

export function noContent(status: number = 204): Response {
  return new HttpResponse(null, { status });
}

/** Resposta de erro no formato do contrato (ADR-0004): `{ error: { code, scope? } }`. */
export function failure(
  status: number,
  code: string,
  options: { scope?: RateLimitScope; retryAfter?: number } = {},
): Response {
  const headers: Record<string, string> = {};
  if (options.retryAfter !== undefined) headers['Retry-After'] = String(options.retryAfter);
  return HttpResponse.json(
    { error: options.scope ? { code, scope: options.scope } : { code } },
    { status, headers },
  );
}

export function fail(
  status: number,
  code: string,
  options: { scope?: RateLimitScope; retryAfter?: number } = {},
): never {
  throw new HttpFailure(failure(status, code, options));
}

/**
 * Regista um handler. Antes de cada pedido lê os dados guardados (outro separador pode tê-los mudado),
 * exige o token CSRF em tudo o que não seja GET e, no fim, guarda os dados.
 */
export function route(method: Method, path: string, resolver: Resolver): HttpHandler {
  return http[method](path, async ({ request, params }) => {
    if (LATENCY_MS > 0) await delay(LATENCY_MS);
    loadDb();
    try {
      const db = getDb();
      if (method !== 'get' && request.headers.get('X-CSRF-Token') !== db.csrfToken) {
        return failure(403, 'csrf_invalid');
      }
      return await resolver({
        request,
        url: new URL(request.url),
        db,
        param: (name) => {
          const value = params[name];
          return typeof value === 'string' ? value : '';
        },
      });
    } catch (error) {
      if (error instanceof HttpFailure) return error.response;
      throw error;
    } finally {
      saveDb();
    }
  });
}

/** Utilizador da sessão, ou `null` se não houver sessão ou o access token tiver expirado. */
export function sessionUser(db: MockDb, now: number = Date.now()): DbUser | null {
  const { sessionId, accessExpiresAt } = db.cookies;
  if (sessionId === null || now >= accessExpiresAt) return null;
  const session = db.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId && user.status === 'active') ?? null;
}

export function requireUser(db: MockDb): DbUser {
  return sessionUser(db) ?? fail(401, 'unauthenticated');
}

/** Sessão válida, MFA configurado quando o papel o exige e permissão do papel. */
export function requirePermission(db: MockDb, permission: Permission): DbUser {
  const user = requireUser(db);
  if (requiresMfa(user.role) && user.totpSecret === null) fail(403, 'mfa_setup_required');
  if (!can(user.role, permission)) fail(403, 'forbidden');
  return user;
}

/** A empresa vem sempre da sessão, nunca do pedido (CLAUDE.md, regra 2). */
export function requireCompany(user: DbUser): string {
  return user.companyId ?? fail(403, 'forbidden');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Simula `forbidNonWhitelisted`: o pedido não pode trazer campos que o schema não conhece. */
function hasOnlyKnownKeys(input: unknown, output: unknown): boolean {
  if (Array.isArray(input)) {
    return Array.isArray(output) && input.every((item, index) => hasOnlyKnownKeys(item, output[index]));
  }
  if (!isPlainObject(input)) return true;
  if (!isPlainObject(output)) return false;
  return Object.keys(input).every((key) => key in output && hasOnlyKnownKeys(input[key], output[key]));
}

/** Corpo JSON validado pelo schema partilhado. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    fail(400, 'invalid_request');
  }
  const result = schema.safeParse(data);
  if (!result.success || !hasOnlyKnownKeys(data, result.data)) fail(422, 'validation_failed');
  return result.data;
}

/** Parâmetros da query validados pelo schema partilhado. */
export function readQuery<S extends z.ZodType>(url: URL, schema: S): z.output<S> {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) fail(400, 'invalid_request');
  return result.data;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paginated<T> {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
}

/**
 * Limite de tentativas por chave. Regista a tentativa e devolve `null`, ou devolve os segundos
 * a esperar (para o cabeçalho Retry-After) se o limite já tiver sido atingido.
 */
export function hitLimit(
  db: MockDb,
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): number | null {
  const recent = (db.attempts[key] ?? []).filter((time) => now - time < windowMs);
  db.attempts[key] = recent;
  if (recent.length >= max) {
    const oldest = recent[0] ?? now;
    return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
  }
  recent.push(now);
  return null;
}
