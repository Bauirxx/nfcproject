import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  authSessionListSchema,
  sessionUserSchema,
  type AccountUpdateRequest,
  type MfaDisableRequest,
  type PasswordChangeRequest,
  type SessionUser,
} from '@nfc-business/shared/schemas';
import { useNavigate } from 'react-router';
import { sessionQueryKey } from '@/app/session-events';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

const sessionsKey = ['account', 'sessions'] as const;

/** Atualiza o nome; a sessão em cache passa a mostrar o novo nome. */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: AccountUpdateRequest) =>
      apiParsed(sessionUserSchema, endpoints.auth.account, { method: 'PATCH', body }),
    onSuccess: (user) => queryClient.setQueryData(sessionQueryKey, user),
  });
}

export function useChangePassword() {
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: PasswordChangeRequest) => apiFetch(endpoints.auth.password, { method: 'POST', body }),
  });
}

/** Desativa o MFA (só papéis que não o exigem); a sessão em cache deixa de o mostrar como ativo. */
export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: MfaDisableRequest) => apiFetch(endpoints.auth.mfaDisable, { method: 'POST', body }),
    onSuccess: () =>
      queryClient.setQueryData<SessionUser | null>(sessionQueryKey, (user) => (user ? { ...user, mfaEnabled: false } : user)),
  });
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: () => apiParsed(authSessionListSchema, endpoints.auth.sessions),
  });
}

/** Termina todas as sessões, incluindo esta: limpa a cache e leva ao login. */
export function useEndAllSessions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => apiFetch(endpoints.auth.sessions, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(sessionQueryKey, null);
      navigate('/entrar', { replace: true });
    },
  });
}
