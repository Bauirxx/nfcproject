// Liga o aviso de sessão perdida do cliente da API (api/events) ao estado da aplicação.
import type { QueryClient } from '@tanstack/react-query';
import { onUnauthorized } from '@/shared/api/events';

export const sessionQueryKey = ['session'] as const;

// Distingue «a sessão expirou enquanto usava a aplicação» de «nunca iniciou sessão»:
// só no primeiro caso a página de sessão expirada é mostrada.
let expired = false;

export function isSessionExpired(): boolean {
  return expired;
}

export function clearSessionExpired(): void {
  expired = false;
}

/** Chamado uma vez no arranque. Quando o cliente da API desiste de renovar, limpa a sessão em cache. */
export function watchSession(queryClient: QueryClient): () => void {
  return onUnauthorized(() => {
    if (queryClient.getQueryData(sessionQueryKey)) expired = true;
    queryClient.setQueryData(sessionQueryKey, null);
  });
}
