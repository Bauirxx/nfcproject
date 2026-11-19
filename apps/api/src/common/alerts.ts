// Alertas de operação (CLAUDE.md, regra 11: «alertas, incluindo picos de envios»; ADR-0021).
// Cada alerta sai sempre no log (nível error, campo `alert`), para ser apanhado por uma ferramenta de logs, e por
// email para ALERT_EMAIL_TO quando configurado. Sem dados pessoais: só o tipo, a rota, contagens e identificadores.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { EmailService } from '../email/email.service';
import { currentRequestId } from './request-context';

export type AlertName = 'server_error' | 'contact_spike' | 'contact_rate_limited' | 'auth_rate_limited';

/** Um alerta igual (tipo + chave) não se repete dentro deste intervalo, nem no log nem por email. */
export const ALERT_COOLDOWN_MS = 15 * 60_000;
const MAX_KEYS = 1_000;

const DESCRIPTIONS: Record<AlertName, string> = {
  server_error: 'Erro interno (5xx) na API.',
  contact_spike: 'Pico de envios de contacto acima do limiar.',
  contact_rate_limited: 'Um utilizador atingiu o limite de envios de contacto.',
  auth_rate_limited: 'Limite de tentativas de autenticação atingido (possível ataque de força bruta).',
};

export type AlertFields = Record<string, string | number>;

@Injectable()
export class AlertService {
  private readonly logger = new Logger('Alert');
  private readonly lastRaised = new Map<string, number>();
  private readonly to: string | null;

  constructor(
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(ENV) env: Env,
  ) {
    this.to = env.ALERT_EMAIL_TO ?? null;
  }

  /**
   * Dispara um alerta. `key` distingue ocorrências do mesmo tipo (por exemplo a rota ou a empresa).
   * Devolve `true` se foi emitido, `false` se estava em silêncio (já emitido há menos de 15 minutos).
   */
  raise(name: AlertName, key: string, fields: AlertFields = {}, now: number = Date.now()): boolean {
    const id = `${name}:${key}`;
    const last = this.lastRaised.get(id);
    if (last !== undefined && now - last < ALERT_COOLDOWN_MS) return false;
    if (this.lastRaised.size >= MAX_KEYS) this.sweep(now);
    this.lastRaised.set(id, now);

    this.logger.error({ msg: DESCRIPTIONS[name], alert: name, ...fields });
    if (this.to && this.email.configured) {
      const requestId = currentRequestId();
      const lines = [
        DESCRIPTIONS[name],
        '',
        `Alerta: ${name}`,
        `Quando: ${new Date(now).toISOString()}`,
        ...Object.entries(fields).map(([field, value]) => `${field}: ${value}`),
        ...(requestId ? [`request_id: ${requestId}`] : []),
        '',
        'Os detalhes estão nos logs do backend (procure pelo request_id ou pelo campo "alert").',
        'Alertas iguais ficam em silêncio durante 15 minutos.',
      ];
      void this.email.sendAlert(this.to, `[NFC Business] Alerta: ${name}`, lines.join('\n'));
    }
    return true;
  }

  private sweep(now: number): void {
    for (const [id, at] of this.lastRaised) {
      if (now - at >= ALERT_COOLDOWN_MS) this.lastRaised.delete(id);
    }
    while (this.lastRaised.size >= MAX_KEYS) {
      const oldest = this.lastRaised.keys().next().value;
      if (oldest === undefined) break;
      this.lastRaised.delete(oldest);
    }
  }
}
