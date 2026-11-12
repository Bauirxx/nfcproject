// Acesso à sessão nos componentes do painel, sobre a consulta `['session']` do TanStack Query.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { can, type Permission } from '@nfc-business/shared/permissions';
import type { SessionUser } from '@nfc-business/shared/schemas';
import { loadSession } from '@/shared/api/session';
import { sessionQueryKey } from './session-events';

/** A sessão é consultada uma vez e só muda por ações explícitas (login, logout, expiração). */
export function useSession(): UseQueryResult<SessionUser | null> {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => loadSession(signal),
    staleTime: Infinity,
    retry: false,
  });
}

export function useCurrentUser(): SessionUser | null {
  return useSession().data ?? null;
}

export function usePermission(permission: Permission): boolean {
  const user = useCurrentUser();
  return user !== null && can(user.role, permission);
}
