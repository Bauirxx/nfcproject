import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AuditAction } from '@nfc-business/shared/constants';
import { auditPageSchema } from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

/** Parâmetros já concretos (o schema usa `z.coerce`, cujo tipo de entrada é `unknown`). */
export type AuditListParams = {
  page: number;
  pageSize: number;
  action?: AuditAction | undefined;
  actor?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

export const auditKeys = {
  all: ['audit'] as const,
  list: (query: AuditListParams) => ['audit', 'list', query] as const,
};

export function useAuditQuery(query: AuditListParams) {
  return useQuery({
    queryKey: auditKeys.list(query),
    queryFn: () => apiParsed(auditPageSchema, endpoints.audit.list, { query }),
    placeholderData: keepPreviousData,
  });
}
