import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { getCsrfToken, setCsrfToken } from './csrf';
import { ApiError } from './errors';
import { onUnauthorized } from './events';
import { loadSession } from './session';

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  credentials: RequestCredentials | undefined;
  keepalive: boolean | undefined;
}

type Handler = (call: Call) => Response;

const calls: Call[] = [];
let routes: Record<string, Handler> = {};

function json(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const session = (csrfToken: string) => () => json(200, { user: null, csrfToken });

function callsTo(key: string): Call[] {
  return calls.filter((call) => `${call.method} ${call.url}` === key);
}

beforeEach(() => {
  calls.length = 0;
  routes = {};
  setCsrfToken(null);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call: Call = {
        method: init.method ?? 'GET',
        url,
        headers: init.headers as Record<string, string>,
        body: init.body,
        credentials: init.credentials,
        keepalive: init.keepalive,
      };
      calls.push(call);
      const handler = routes[`${call.method} ${url}`];
      if (!handler) throw new TypeError(`Sem rota para ${call.method} ${url}`);
      return handler(call);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch — pedidos', () => {
  it('envia as credenciais e não envia token CSRF num GET', async () => {
    routes['GET /api/cards'] = () => json(200, { items: [] });

    await expect(apiFetch('/api/cards')).resolves.toEqual({ items: [] });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.credentials).toBe('include');
    expect(calls[0]?.headers.Accept).toBe('application/json');
    expect(calls[0]?.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('só aceita caminhos /api/ na mesma origem', async () => {
    for (const path of ['https://evil.test/api/cards', '//evil.test/api/cards', '/outra/coisa', 'api/cards', '/api/../admin']) {
      await expect(apiFetch(path)).rejects.toThrow('invalid_api_path');
    }
    expect(calls).toHaveLength(0);
  });

  it('serializa a query e ignora valores vazios', async () => {
    routes['GET /api/cards?search=ana+silva&page=2'] = () => json(200, { items: [] });

    await apiFetch('/api/cards', { query: { search: 'ana silva', status: undefined, page: 2, empty: '', none: null } });

    expect(calls[0]?.url).toBe('/api/cards?search=ana+silva&page=2');
  });

  it('devolve undefined em respostas sem corpo', async () => {
    routes['GET /api/auth/sessions'] = () => new Response(null, { status: 204 });
    await expect(apiFetch('/api/auth/sessions')).resolves.toBeUndefined();
  });

  it('envia um Blob tal como está, com o seu tipo', async () => {
    setCsrfToken('token-em-memoria-1234');
    routes['PUT /api/uploads/f1?sig=abc'] = () => new Response(null, { status: 204 });
    const file = new Blob(['conteudo'], { type: 'image/png' });

    await apiFetch('/api/uploads/f1?sig=abc', { method: 'PUT', body: file });

    expect(calls[0]?.body).toBe(file);
    expect(calls[0]?.headers['Content-Type']).toBe('image/png');
    expect(calls[0]?.headers['X-CSRF-Token']).toBe('token-em-memoria-1234');
  });
});

describe('apiFetch — CSRF', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'] as const)('envia X-CSRF-Token em %s', async (method) => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes[`${method} /api/cards/c1`] = () => json(200, { ok: true });

    await apiFetch('/api/cards/c1', { method, body: method === 'DELETE' ? undefined : { label: 'x' } });

    const request = callsTo(`${method} /api/cards/c1`)[0];
    expect(request?.headers['X-CSRF-Token']).toBe('token-csrf-0000000001');
    expect(request?.credentials).toBe('include');
  });

  it('pede o token uma só vez, mesmo com pedidos em simultâneo', async () => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes['POST /api/cards'] = () => json(201, { id: 'c1' });

    await Promise.all([
      apiFetch('/api/cards', { method: 'POST', body: { label: 'a' } }),
      apiFetch('/api/cards', { method: 'POST', body: { label: 'b' } }),
    ]);
    await apiFetch('/api/cards', { method: 'POST', body: { label: 'c' } });

    expect(callsTo('GET /api/auth/session')).toHaveLength(1);
    expect(callsTo('POST /api/cards')).toHaveLength(3);
    expect(callsTo('POST /api/cards')[0]?.body).toBe(JSON.stringify({ label: 'a' }));
  });

  it('com csrf_invalid renova o token e repete o pedido uma vez', async () => {
    setCsrfToken('token-antigo-000000001');
    routes['GET /api/auth/session'] = session('token-novo-0000000002');
    routes['POST /api/cards'] = (call) =>
      call.headers['X-CSRF-Token'] === 'token-novo-0000000002'
        ? json(201, { id: 'c1' })
        : json(403, { error: { code: 'csrf_invalid' } });

    await expect(apiFetch('/api/cards', { method: 'POST', body: {} })).resolves.toEqual({ id: 'c1' });
    expect(callsTo('POST /api/cards')).toHaveLength(2);
  });

  it('não repete indefinidamente quando o token continua inválido', async () => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes['POST /api/cards'] = () => json(403, { error: { code: 'csrf_invalid' } });

    await expect(apiFetch('/api/cards', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 403, code: 'csrf_invalid' });
    expect(callsTo('POST /api/cards')).toHaveLength(2);
  });

  it('esquece o token depois do login, porque a sessão é outra', async () => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes['POST /api/auth/login'] = () => json(200, { status: 'mfa_required' });

    await apiFetch('/api/auth/login', { method: 'POST', body: { email: 'a@b.test', password: 'x' } });

    expect(getCsrfToken()).toBeNull();
  });
});

describe('apiFetch — 401 e renovação da sessão', () => {
  it('renova a sessão uma vez e repete o pedido', async () => {
    let renewed = false;
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes['POST /api/auth/refresh'] = () => {
      renewed = true;
      return new Response(null, { status: 204 });
    };
    routes['GET /api/cards'] = () => (renewed ? json(200, { items: [] }) : json(401, { error: { code: 'unauthorized' } }));
    const unauthorized = vi.fn();
    const off = onUnauthorized(unauthorized);

    const [first, second] = await Promise.all([apiFetch('/api/cards'), apiFetch('/api/cards')]);
    off();

    expect(first).toEqual({ items: [] });
    expect(second).toEqual({ items: [] });
    expect(callsTo('POST /api/auth/refresh')).toHaveLength(1);
    expect(callsTo('POST /api/auth/refresh')[0]?.headers['X-CSRF-Token']).toBe('token-csrf-0000000001');
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('se a renovação falhar, avisa que a sessão acabou e rejeita com 401', async () => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes['POST /api/auth/refresh'] = () => json(401, { error: { code: 'unauthorized' } });
    routes['GET /api/cards'] = () => json(401, { error: { code: 'unauthorized' } });
    const unauthorized = vi.fn();
    const off = onUnauthorized(unauthorized);

    await expect(apiFetch('/api/cards')).rejects.toMatchObject({ status: 401 });
    off();

    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(callsTo('GET /api/cards')).toHaveLength(1);
  });

  it('um 401 no login é a resposta final: não renova nem avisa', async () => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');
    routes['POST /api/auth/login'] = () => json(401, { error: { code: 'invalid_credentials' } });
    const unauthorized = vi.fn();
    const off = onUnauthorized(unauthorized);

    await expect(apiFetch('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
    off();

    expect(callsTo('POST /api/auth/refresh')).toHaveLength(0);
    expect(unauthorized).not.toHaveBeenCalled();
  });
});

describe('apiFetch — erros', () => {
  it('um 429 traz o âmbito do limite e o tempo de espera', async () => {
    setCsrfToken('token-em-memoria-1234');
    routes['POST /api/contact-shares'] = () => json(429, { error: { code: 'rate_limited', scope: 'hour' } }, { 'Retry-After': '120' });

    const error = await apiFetch('/api/contact-shares', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'rate_limited', scope: 'hour', retryAfter: 120 });
  });

  it('um 403 chega como ApiError sem repetir o pedido', async () => {
    routes['GET /api/companies'] = () => json(403, { error: { code: 'forbidden' } });

    await expect(apiFetch('/api/companies')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    expect(calls).toHaveLength(1);
  });

  it('nunca expõe texto do servidor: códigos fora do formato passam a unknown_error', async () => {
    routes['GET /api/cards'] = () => json(500, { error: { code: 'SELECT * FROM users falhou', scope: 'tudo' }, message: 'stack trace' });
    routes['GET /api/profiles'] = () => new Response('<html>erro</html>', { status: 502 });

    await expect(apiFetch('/api/cards')).rejects.toMatchObject({ status: 500, code: 'unknown_error', scope: undefined });
    await expect(apiFetch('/api/profiles')).rejects.toMatchObject({ status: 502, code: 'unknown_error' });
  });

  it('sem resposta rejeita com estado 0', async () => {
    await expect(apiFetch('/api/sem-rota')).rejects.toMatchObject({ status: 0, code: 'network_error' });
  });
});

describe('loadSession', () => {
  it('devolve o utilizador e guarda o token CSRF em memória', async () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@acme.test', role: 'company_admin' };
    routes['GET /api/auth/session'] = () => json(200, { user, csrfToken: 'token-csrf-0000000001' });

    await expect(loadSession()).resolves.toEqual(user);
    expect(getCsrfToken()).toBe('token-csrf-0000000001');
  });

  it('devolve null para visitantes, sem tentar renovar', async () => {
    routes['GET /api/auth/session'] = session('token-csrf-0000000001');

    await expect(loadSession()).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('renova a sessão quando o access token expirou mas há refresh token', async () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@acme.test', role: 'profile_owner' };
    let renewed = false;
    routes['GET /api/auth/session'] = () =>
      renewed
        ? json(200, { user, csrfToken: 'token-novo-0000000002' })
        : json(200, { user: null, csrfToken: 'token-csrf-0000000001', refreshable: true });
    routes['POST /api/auth/refresh'] = () => {
      renewed = true;
      return new Response(null, { status: 204 });
    };

    await expect(loadSession()).resolves.toEqual(user);
    expect(callsTo('POST /api/auth/refresh')).toHaveLength(1);
    expect(getCsrfToken()).toBe('token-novo-0000000002');
  });
});
