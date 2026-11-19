import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../config/env';
import { EmailService } from '../email/email.service';
import { ALERT_COOLDOWN_MS, AlertService } from './alerts';
import { formatLogLine, JsonLogger } from './json-logger';
import { runWithRequestContext } from './request-context';
import { requestLogging } from './request-logging';
import { COMPANY_SPIKE_THRESHOLD, PLATFORM_SPIKE_THRESHOLD, RequestMonitor, SPIKE_WINDOW_MS } from './request-monitor';

const NOW = new Date('2026-11-19T10:00:00.000Z');

describe('logger JSON', () => {
  it('uma linha JSON com hora, nível, contexto, mensagem e o request_id do pedido em curso', () => {
    const line = runWithRequestContext({ requestId: 'req-1' }, () => formatLogLine('info', 'olá', 'Teste', {}, NOW));
    expect(JSON.parse(line)).toEqual({ time: NOW.toISOString(), level: 'info', context: 'Teste', msg: 'olá', request_id: 'req-1' });
    expect(JSON.parse(formatLogLine('info', 'fora', undefined, {}, NOW))).not.toHaveProperty('request_id');
  });

  it('quebras de linha do utilizador não forjam linhas; campos reservados e objetos não entram', () => {
    const line = formatLogLine('warn', 'a\n{"level":"info","msg":"forjado"}', 'X', {
      fields: { level: 'debug', request_id: 'falso', body: { password: 'x' }, ok: 1 },
    }, NOW);
    expect(line.split('\n')).toHaveLength(1);
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed).toMatchObject({ level: 'warn', msg: 'a\n{"level":"info","msg":"forjado"}', ok: 1 });
    expect(parsed).not.toHaveProperty('request_id');
    expect(parsed).not.toHaveProperty('body');
  });

  it('segue as convenções do Logger do Nest: contexto no fim e stack no erro; debug escondido em produção', () => {
    const lines: string[] = [];
    const logger = new JsonLogger('info', (line) => lines.push(line));
    logger.log('arranque', 'NestApplication');
    logger.error('falhou', 'Error: x\n    at y', 'Api');
    logger.error({ msg: 'alerta', alert: 'server_error' }, undefined, 'Alert');
    logger.debug('detalhe', 'Teste');
    const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ level: 'info', context: 'NestApplication', msg: 'arranque' });
    expect(parsed[1]).toMatchObject({ level: 'error', context: 'Api', msg: 'falhou', stack: 'Error: x\n    at y' });
    expect(parsed[2]).toMatchObject({ level: 'error', context: 'Alert', msg: 'alerta', alert: 'server_error' });
  });
});

function alertSetup(env: Record<string, string> = {}) {
  const email = new EmailService(loadEnv(env));
  const sendAlert = vi.spyOn(email, 'sendAlert').mockResolvedValue(true);
  const alerts = new AlertService(email, loadEnv(env));
  return { alerts, sendAlert };
}

describe('alertas', () => {
  afterEach(() => vi.restoreAllMocks());

  it('o mesmo alerta fica em silêncio 15 minutos; outra chave não', () => {
    const { alerts } = alertSetup();
    const t = NOW.getTime();
    expect(alerts.raise('server_error', '/api/cards', {}, t)).toBe(true);
    expect(alerts.raise('server_error', '/api/cards', {}, t + 60_000)).toBe(false);
    expect(alerts.raise('server_error', '/api/profiles', {}, t + 60_000)).toBe(true);
    expect(alerts.raise('server_error', '/api/cards', {}, t + ALERT_COOLDOWN_MS)).toBe(true);
  });

  it('envia email só com ALERT_EMAIL_TO e RESEND_API_KEY, sem dados pessoais', () => {
    expect(alertSetup({ ALERT_EMAIL_TO: 'ops@exemplo.test' }).alerts.raise('server_error', 'a')).toBe(true);
    const off = alertSetup({ ALERT_EMAIL_TO: 'ops@exemplo.test' });
    off.alerts.raise('server_error', 'a');
    expect(off.sendAlert).not.toHaveBeenCalled();

    const on = alertSetup({ ALERT_EMAIL_TO: 'ops@exemplo.test', RESEND_API_KEY: 're_teste_1234567890' }); // gitleaks:allow (chave inventada)
    on.alerts.raise('contact_spike', 'co_1', { scope: 'company', company_id: 'co_1', sends_15min: 50 });
    expect(on.sendAlert).toHaveBeenCalledTimes(1);
    const [to, subject, text] = on.sendAlert.mock.calls[0]!;
    expect(to).toBe('ops@exemplo.test');
    expect(subject).toBe('[NFC Business] Alerta: contact_spike');
    expect(text).toContain('sends_15min: 50');
  });
});

describe('regras de alerta', () => {
  function monitorSetup() {
    const raise = vi.fn(() => true);
    const monitor = new RequestMonitor({ raise } as unknown as AlertService);
    return { monitor, raise };
  }

  it('5xx, limite de envios e limite de autenticação disparam alertas', () => {
    const { monitor, raise } = monitorSetup();
    monitor.observe({ method: 'GET', route: '/api/cards/:id', status: 500, companyId: 'co_1' });
    monitor.observe({ method: 'POST', route: '/api/contact-shares', status: 429, companyId: 'co_1' });
    monitor.observe({ method: 'POST', route: '/api/auth/login', status: 429, companyId: null });
    monitor.observe({ method: 'GET', route: '/api/cards', status: 429, companyId: 'co_1' });
    monitor.observe({ method: 'POST', route: '/api/auth/login', status: 401, companyId: null });
    expect(raise.mock.calls.map((call) => (call as unknown[])[0])).toEqual(['server_error', 'contact_rate_limited', 'auth_rate_limited']);
  });

  it(`pico: ${COMPANY_SPIKE_THRESHOLD} envios da mesma empresa em 15 minutos`, () => {
    const { monitor, raise } = monitorSetup();
    const t = NOW.getTime();
    const send = (companyId: string, at: number) =>
      monitor.observe({ method: 'POST', route: '/api/contact-shares', status: 201, companyId }, at);
    for (let i = 0; i < COMPANY_SPIKE_THRESHOLD - 1; i += 1) send('co_1', t + i * 1000);
    expect(raise).not.toHaveBeenCalled();
    // Espalhados por mais de 15 minutos não contam todos.
    send('co_1', t + SPIKE_WINDOW_MS + 60_000);
    expect(raise).not.toHaveBeenCalled();
    for (let i = 0; i < COMPANY_SPIKE_THRESHOLD; i += 1) send('co_2', t + i * 1000);
    expect(raise).toHaveBeenCalledWith('contact_spike', 'co_2', expect.objectContaining({ scope: 'company', sends_15min: COMPANY_SPIKE_THRESHOLD }), expect.any(Number));
  });

  it(`pico na plataforma: ${PLATFORM_SPIKE_THRESHOLD} envios em 15 minutos, de várias empresas`, () => {
    const { monitor, raise } = monitorSetup();
    const t = NOW.getTime();
    for (let i = 0; i < PLATFORM_SPIKE_THRESHOLD; i += 1) {
      monitor.observe({ method: 'POST', route: '/api/contact-shares', status: 201, companyId: `co_${i % 10}` }, t + i);
    }
    expect(raise).toHaveBeenCalledWith('contact_spike', 'platform', expect.objectContaining({ scope: 'platform' }), expect.any(Number));
  });
});

describe('log de acesso', () => {
  it('request_id no cabeçalho e nos logs do pedido; rota padrão, sem token nem query string', async () => {
    const lines: string[] = [];
    const logger = new JsonLogger('debug', (line) => lines.push(line));
    const observe = vi.fn();
    const app = express();
    app.use(requestLogging(logger, { observe } as unknown as RequestMonitor));
    app.get('/api/public/cards/:token', (_req, res) => {
      setTimeout(() => {
        logger.log('dentro do pedido', 'Teste');
        res.status(404).json({ error: { code: 'not_found' } });
      }, 5);
    });
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const token = 'SegredoDoCartao1234567'; // gitleaks:allow (token fictício do teste)
      const response = await fetch(`http://127.0.0.1:${port}/api/public/cards/${token}?t=codigo-secreto`);
      await fetch(`http://127.0.0.1:${port}/api/health`);
      await new Promise((resolve) => setTimeout(resolve, 20));

      const requestId = response.headers.get('x-request-id');
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(parsed.find((entry) => entry.msg === 'dentro do pedido')?.request_id).toBe(requestId);
      const access = parsed.filter((entry) => entry.msg === 'request');
      // O health com sucesso não é registado (o Render chama-o a cada poucos segundos).
      expect(access).toHaveLength(1);
      expect(access[0]).toMatchObject({ method: 'GET', route: '/api/public/cards/:token', status: 404, request_id: requestId, context: 'Http' });
      expect(lines.join('\n')).not.toContain(token);
      expect(lines.join('\n')).not.toContain('codigo-secreto');
      expect(observe).toHaveBeenCalledWith({ method: 'GET', route: '/api/public/cards/:token', status: 404, companyId: null });
      expect(observe).toHaveBeenCalledTimes(2);
    } finally {
      server.close();
    }
  });
});
