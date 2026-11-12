import type { SessionResponse, SessionUser } from '@nfc-business/shared/schemas';
import { apiFetch, refreshSession } from './client';
import { endpoints } from './endpoints';

/**
 * Utilizador da sessão atual, ou `null` para visitantes. A consulta atualiza também o token CSRF em memória.
 * Se o access token expirou mas ainda há refresh token (`refreshable`), renova a sessão e consulta de novo.
 */
export async function loadSession(signal?: AbortSignal): Promise<SessionUser | null> {
  let session = await apiFetch<SessionResponse>(endpoints.auth.session, { signal });
  if (!session.user && session.refreshable && (await refreshSession())) {
    session = await apiFetch<SessionResponse>(endpoints.auth.session, { signal });
  }
  return session.user ?? null;
}
