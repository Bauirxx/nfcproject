import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  memberListSchema,
  profilePageSchema,
  profileSchema,
  type ProfileCreateRequest,
  type ProfileUpdateRequest,
} from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

/** Parâmetros já concretos da lista (o schema usa `z.coerce`, cujo tipo de entrada é `unknown`). */
export type ProfileListParams = {
  page: number;
  pageSize: number;
  search?: string | undefined;
};

export const profileKeys = {
  all: ['profiles'] as const,
  list: (query: ProfileListParams) => ['profiles', 'list', query] as const,
  detail: (id: string) => ['profiles', 'detail', id] as const,
};

export function useProfilesQuery(query: ProfileListParams) {
  return useQuery({
    queryKey: profileKeys.list(query),
    queryFn: () => apiParsed(profilePageSchema, endpoints.profiles.list, { query }),
    placeholderData: keepPreviousData,
  });
}

export function useProfileQuery(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: () => apiParsed(profileSchema, endpoints.profiles.one(id)),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileCreateRequest) => apiParsed(profileSchema, endpoints.profiles.list, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useUpdateProfile(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ProfileUpdateRequest) =>
      apiParsed(profileSchema, endpoints.profiles.one(id), { method: 'PATCH', body }),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.detail(id), profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/**
 * Membros da empresa para o seletor de dono. Só é usada por quem pode atribuir donos
 * (`profiles.assignOwner`, ou seja, company_admin), pelo que corre atrás da permissão `members.manage`.
 */
export function useCompanyMembersQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['members', 'list'] as const,
    queryFn: () => apiParsed(memberListSchema, endpoints.members.list),
    enabled,
  });
}
