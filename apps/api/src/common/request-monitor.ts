// Regras de alerta sobre os pedidos terminados (ADR-0021). Observa só o resultado (rota, estado, empresa), por isso
// não mexe na lógica dos serviços. Em memória: serve a instância única do Render (como o FixedWindowRateLimiter).
import { Inject, Injectable } from '@nestjs/common';
import { AlertService } from './alerts';

/** Janela e limiares do pico de envios. Valores assumidos (ADR-0021), a ajustar com o uso real. */
export const SPIKE_WINDOW_MS = 15 * 60_000;
/** Por empresa: 10% do limite diário da empresa (500) em 15 minutos. */
export const COMPANY_SPIKE_THRESHOLD = 50;
/** Em toda a plataforma. */
export const PLATFORM_SPIKE_THRESHOLD = 200;

const CONTACT_SHARES_ROUTE = '/api/contact-shares';
/** Rotas com limite de tentativas (regra 1): um 429 aqui indica tentativas repetidas. */
const AUTH_LIMITED_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/recover',
  '/api/auth/mfa/verify',
  '/api/auth/mfa/confirm',
  '/api/auth/password',
]);
const MAX_COMPANIES = 10_000;

export interface RequestSummary {
  method: string;
  /** Rota padrão (por exemplo `/api/cards/:id`), nunca o caminho concreto. */
  route: string;
  status: number;
  companyId: string | null;
}

@Injectable()
export class RequestMonitor {
  private readonly companySends = new Map<string, number[]>();
  private platformSends: number[] = [];

  constructor(@Inject(AlertService) private readonly alerts: AlertService) {}

  observe(request: RequestSummary, now: number = Date.now()): void {
    if (request.status >= 500) {
      this.alerts.raise('server_error', request.route, { route: request.route, status: request.status }, now);
    }
    if (request.method === 'POST' && request.route === CONTACT_SHARES_ROUTE) {
      if (request.status === 429) {
        this.alerts.raise('contact_rate_limited', request.companyId ?? '-', { company_id: request.companyId ?? '-' }, now);
      } else if (request.status >= 200 && request.status < 300) {
        this.recordSend(request.companyId, now);
      }
    }
    if (request.status === 429 && AUTH_LIMITED_ROUTES.has(request.route)) {
      this.alerts.raise('auth_rate_limited', request.route, { route: request.route }, now);
    }
  }

  private recordSend(companyId: string | null, now: number): void {
    const since = now - SPIKE_WINDOW_MS;
    this.platformSends = this.platformSends.filter((at) => at > since);
    this.platformSends.push(now);
    if (this.platformSends.length >= PLATFORM_SPIKE_THRESHOLD) {
      this.alerts.raise('contact_spike', 'platform', { scope: 'platform', sends_15min: this.platformSends.length }, now);
    }
    if (!companyId) return;

    if (!this.companySends.has(companyId) && this.companySends.size >= MAX_COMPANIES) this.prune(since);
    const sends = (this.companySends.get(companyId) ?? []).filter((at) => at > since);
    sends.push(now);
    this.companySends.set(companyId, sends);
    if (sends.length >= COMPANY_SPIKE_THRESHOLD) {
      this.alerts.raise('contact_spike', companyId, { scope: 'company', company_id: companyId, sends_15min: sends.length }, now);
    }
  }

  private prune(since: number): void {
    for (const [companyId, sends] of this.companySends) {
      if (!sends.some((at) => at > since)) this.companySends.delete(companyId);
    }
  }
}
