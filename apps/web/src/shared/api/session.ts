import { ROLES } from '@nfc-business/shared/constants';
import type { SessionUser } from '@nfc-business/shared/schemas';
import { apiFetch, refreshSession } from './client';
import { endpoints } from './endpoints';

const ROLE_SET = new Set<string>(ROLES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isStringOrNull = (value: unknown): boolean => value === null || typeof value === 'string';

/**
 * Guarda de tipo do `sessionUserSchema`, sem Zod (a página pública também carrega a sessão e não pode
 * levar o Zod no bundle inicial, ADR-0003). Um utilizador fora do contrato não é uma sessão: falha fechada.
 */
export function isSessionUser(value: unknown): value is SessionUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.role === 'string' &&
    ROLE_SET.has(value.role) &&
    isStringOrNull(value.companyId) &&
    isStringOrNull(value.companyName) &&
    typeof value.mfaEnabled === 'boolean' &&
    typeof value.mfaRequired === 'boolean'
  );
}

/**
 * Utilizador da sessão atual, ou `null` para visitantes. A consulta atualiza também o token CSRF em memória.
 * Se o access token expirou mas ainda há refresh token (`refreshable`), renova a sessão e consulta de novo.
 * Uma resposta fora do contrato conta como sem sessão (nunca se mostra o painel com dados incompletos).
 */
export async function loadSession(signal?: AbortSignal): Promise<SessionUser | null> {
  let session = await apiFetch<unknown>(endpoints.auth.session, { signal });
  if (isRecord(session) && !session.user && session.refreshable === true && (await refreshSession())) {
    session = await apiFetch<unknown>(endpoints.auth.session, { signal });
  }
  const user = isRecord(session) ? session.user : null;
  return isSessionUser(user) ? user : null;
}
