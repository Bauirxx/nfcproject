import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contactSharePageSchema,
  contactShareSchema,
  profilePageSchema,
  type ContactShareRequest,
} from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

/** Perfil que pode ser partilhado: tem cartão ativo, cujo token serve o link do cartão. */
export interface SendableProfile {
  id: string;
  displayName: string;
  activeCardToken: string;
}

export type ContactShareListParams = {
  page: number;
  pageSize: number;
  profileId?: string | undefined;
};

export const contactShareKeys = {
  all: ['contact-shares'] as const,
  sendable: ['contact-shares', 'sendable'] as const,
  list: (query: ContactShareListParams) => ['contact-shares', 'list', query] as const,
};

/** Perfis visíveis com cartão ativo, para o seletor do formulário de envio. */
export function useSendableProfilesQuery() {
  return useQuery({
    queryKey: contactShareKeys.sendable,
    queryFn: async (): Promise<SendableProfile[]> => {
      const page = await apiParsed(profilePageSchema, endpoints.profiles.list, { query: { pageSize: 100 } });
      return page.items
        .filter((profile) => profile.activeCardToken !== null)
        .map((profile) => ({ id: profile.id, displayName: profile.displayName, activeCardToken: profile.activeCardToken as string }));
    },
  });
}

export function useContactSharesQuery(query: ContactShareListParams) {
  return useQuery({
    queryKey: contactShareKeys.list(query),
    queryFn: () => apiParsed(contactSharePageSchema, endpoints.contactShares.list, { query }),
    placeholderData: keepPreviousData,
  });
}

/** Regista o envio. O erro aparece no próprio formulário (`inlineError`), incluindo o limite 429. */
export function useCreateContactShare() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ContactShareRequest) =>
      apiParsed(contactShareSchema, endpoints.contactShares.list, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-shares', 'list'] }),
  });
}
