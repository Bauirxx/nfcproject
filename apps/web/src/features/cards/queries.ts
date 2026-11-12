import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CardAction, CardStatus } from '@nfc-business/shared/constants';
import {
  cardHistorySchema,
  cardPageSchema,
  cardSchema,
  profilePageSchema,
  type CardCreateRequest,
  type CardUpdateRequest,
} from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

/** Parâmetros já concretos da lista (o schema usa `z.coerce`, cujo tipo de entrada é `unknown`). */
export type CardListParams = {
  page: number;
  pageSize: number;
  search?: string | undefined;
  status?: CardStatus | undefined;
};

export const cardKeys = {
  all: ['cards'] as const,
  list: (query: CardListParams) => ['cards', 'list', query] as const,
  detail: (id: string) => ['cards', 'detail', id] as const,
  history: (id: string) => ['cards', 'history', id] as const,
};

export function useCardsQuery(query: CardListParams) {
  return useQuery({
    queryKey: cardKeys.list(query),
    queryFn: () => apiParsed(cardPageSchema, endpoints.cards.list, { query }),
    placeholderData: keepPreviousData,
  });
}

export function useCardQuery(id: string) {
  return useQuery({
    queryKey: cardKeys.detail(id),
    queryFn: () => apiParsed(cardSchema, endpoints.cards.one(id)),
  });
}

export function useCardHistoryQuery(id: string) {
  return useQuery({
    queryKey: cardKeys.history(id),
    queryFn: () => apiParsed(cardHistorySchema, endpoints.cards.history(id)),
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CardCreateRequest) => apiParsed(cardSchema, endpoints.cards.list, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.all }),
  });
}

export function useUpdateCard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CardUpdateRequest) => apiParsed(cardSchema, endpoints.cards.one(id), { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.all }),
  });
}

export function useCardAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: CardAction) => apiParsed(cardSchema, endpoints.cards.action(id, action), { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.all }),
  });
}

/** Perfis da empresa para associar a um cartão (lista curta para um select). */
export function useProfileOptionsQuery() {
  return useQuery({
    queryKey: ['profiles', 'options'],
    queryFn: async () => {
      const page = await apiParsed(profilePageSchema, endpoints.profiles.list, { query: { pageSize: 100 } });
      return page.items.map((profile) => ({ id: profile.id, displayName: profile.displayName }));
    },
  });
}
