import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getDb, resetDb } from '../db';
import { startSession } from '../domain';
import { hitLimit, json, paginate, readBody, requirePermission, route } from './http';

const server = setupServer(
  route('get', '/api/test/open', () => json({ ok: true })),
  route('post', '/api/test/echo', async ({ request }) =>
    json(await readBody(request, z.object({ name: z.string().min(2), tags: z.array(z.string()).optional() }))),
  ),
  route('get', '/api/test/cards', ({ db }) => json({ role: requirePermission(db, 'cards.view').role })),
  route('get', '/api/test/items/:id', ({ param }) => json({ id: param('id') })),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  resetDb();
});
afterAll(() => server.close());

function signIn(userId: string): void {
  const db = getDb();
  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error(`utilizador desconhecido: ${userId}`);
  startSession(db, user);
}

function post(body: string, withCsrf: boolean = true): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withCsrf) headers['X-CSRF-Token'] = getDb().csrfToken;
  return fetch('/api/test/echo', { method: 'POST', headers, body });
}

async function errorCode(response: Response): Promise<unknown> {
  const body = (await response.json()) as { error?: { code?: unknown } };
  return body.error?.code;
}

describe('handlers da API simulada', () => {
  it('responde a GET sem token CSRF e lê os parâmetros do caminho', async () => {
    expect((await fetch('/api/test/open')).status).toBe(200);
    await expect((await fetch('/api/test/items/abc')).json()).resolves.toEqual({ id: 'abc' });
  });

  it('exige o token CSRF nos pedidos que alteram dados', async () => {
    const refused = await post(JSON.stringify({ name: 'Ana' }), false);
    expect(refused.status).toBe(403);
    expect(await errorCode(refused)).toBe('csrf_invalid');

    const accepted = await post(JSON.stringify({ name: 'Ana' }));
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toEqual({ name: 'Ana' });
  });

  it('recusa corpos inválidos e campos desconhecidos', async () => {
    const notJson = await post('{');
    expect(notJson.status).toBe(400);
    expect(await errorCode(notJson)).toBe('invalid_request');

    const invalid = await post(JSON.stringify({ name: 'A' }));
    expect(invalid.status).toBe(422);
    expect(await errorCode(invalid)).toBe('validation_failed');

    const extraField = await post(JSON.stringify({ name: 'Ana', role: 'platform_admin' }));
    expect(extraField.status).toBe(422);

    expect((await post(JSON.stringify({ name: 'Ana', tags: ['a', 'b'] }))).status).toBe(200);
  });

  it('aplica sessão, MFA obrigatório e permissões do papel', async () => {
    const anonymous = await fetch('/api/test/cards');
    expect(anonymous.status).toBe(401);
    expect(await errorCode(anonymous)).toBe('unauthenticated');

    signIn('u_paula');
    const owner = await fetch('/api/test/cards');
    expect(owner.status).toBe(403);
    expect(await errorCode(owner)).toBe('forbidden');

    signIn('u_nelson');
    const adminWithoutMfa = await fetch('/api/test/cards');
    expect(adminWithoutMfa.status).toBe(403);
    expect(await errorCode(adminWithoutMfa)).toBe('mfa_setup_required');

    signIn('u_ana');
    await expect((await fetch('/api/test/cards')).json()).resolves.toEqual({ role: 'company_admin' });
  });

  it('trata o access token expirado como falta de sessão', async () => {
    signIn('u_ana');
    getDb().cookies.accessExpiresAt = Date.now() - 1;
    expect((await fetch('/api/test/cards')).status).toBe(401);
  });
});

describe('hitLimit', () => {
  it('deixa passar até ao limite e depois diz quanto esperar', () => {
    const db = getDb();
    const start = 1_000_000;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(hitLimit(db, 'login:a@b.test', 5, 60_000, start + attempt * 1000)).toBeNull();
    }
    expect(hitLimit(db, 'login:a@b.test', 5, 60_000, start + 10_000)).toBe(50);
    expect(hitLimit(db, 'login:outro@b.test', 5, 60_000, start + 10_000)).toBeNull();
    expect(hitLimit(db, 'login:a@b.test', 5, 60_000, start + 61_000)).toBeNull();
  });
});

describe('paginate', () => {
  it('devolve a página pedida e o total', () => {
    const items = Array.from({ length: 45 }, (_, index) => index + 1);
    expect(paginate(items, 3, 20)).toEqual({ items: [41, 42, 43, 44, 45], page: 3, pageSize: 20, total: 45 });
    expect(paginate(items, 4, 20).items).toEqual([]);
  });
});
