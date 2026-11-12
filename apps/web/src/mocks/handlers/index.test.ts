import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '../credentials';
import { handlers } from './index';
import { api, errorCode, signIn, useMockServer } from './testing';

useMockServer(handlers);

describe('handlers da API simulada', () => {
  it('não regista duas vezes o mesmo método e caminho', () => {
    const seen = new Set<string>();
    for (const handler of handlers) {
      const key = `${handler.info.method.toString()} ${handler.info.path.toString()}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    expect(handlers.length).toBeGreaterThan(40);
  });

  it('serve os endpoints de todos os módulos', async () => {
    expect((await api('GET', '/api/auth/session')).status).toBe(200);
    expect((await api('GET', `/api/public/cards/${MOCK_TOKENS.activeCard}`)).status).toBe(200);
    expect((await api('POST', '/api/public/events', { type: 'view', token: MOCK_TOKENS.activeCard })).status).toBe(204);
    expect((await api('GET', '/api/cards')).status).toBe(401);
    signIn('u_ana');
    for (const path of ['/api/cards', '/api/profiles', '/api/members', '/api/contact-shares', '/api/audit']) {
      expect((await api('GET', path)).status, path).toBe(200);
    }
    expect((await api('GET', '/api/analytics/summary?from=2026-11-01&to=2026-11-12')).status).toBe(200);
    signIn('u_marta');
    expect((await api('GET', '/api/companies')).status).toBe(200);
  });

  it('responde 404 no formato do contrato a caminhos e métodos desconhecidos', async () => {
    for (const [method, path] of [
      ['GET', '/api/nao-existe'],
      ['GET', '/api/cards/c_paula/qr.png'],
      ['DELETE', '/api/cards/c_paula'],
      ['POST', '/api/public/cards/abc'],
    ] as const) {
      const response = await api(method, path);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(await errorCode(response)).toBe('not_found');
    }
  });
});
