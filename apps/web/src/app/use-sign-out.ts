import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { sessionQueryKey } from './session-events';

/** Termina a sessão deste browser e leva ao login. Limpa a cache mesmo que o pedido falhe. */
export function useSignOut(): UseMutationResult<unknown, Error, void> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(endpoints.auth.logout, { method: 'POST' }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(sessionQueryKey, null);
      navigate('/entrar', { replace: true });
    },
  });
}
