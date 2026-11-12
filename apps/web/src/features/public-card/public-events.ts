// Registo de eventos públicos (lista fechada: view, whatsapp_click, email_click, vcf_download).
// Falhas são ignoradas — nunca atrapalham a visita.
import type { PublicEventType } from '@nfc-business/shared/constants';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';

export type PublicKind = 'card' | 'profile';

export function recordPublicEvent(kind: PublicKind, id: string, type: PublicEventType): void {
  const body = kind === 'card' ? { type, token: id } : { type, slug: id };
  void apiFetch(endpoints.public.events, { method: 'POST', body, keepalive: true }).catch(() => undefined);
}
