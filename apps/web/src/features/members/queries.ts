import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberRole } from '@nfc-business/shared/constants';
import { memberListSchema, memberSchema, type MemberInviteRequest } from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiFetch } from '@/shared/api/client';
import { apiParsed } from '@/shared/lib/parsed-api';

export const memberKeys = {
  all: ['members'] as const,
  list: ['members', 'list'] as const,
};

export function useMembersQuery() {
  return useQuery({
    queryKey: memberKeys.list,
    queryFn: () => apiParsed(memberListSchema, endpoints.members.list),
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: MemberInviteRequest) => apiParsed(memberSchema, endpoints.members.list, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: MemberRole }) =>
      apiParsed(memberSchema, endpoints.members.one(id), { method: 'PATCH', body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(endpoints.members.one(id), { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.all }),
  });
}
