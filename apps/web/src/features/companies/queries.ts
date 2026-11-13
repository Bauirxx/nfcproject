import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  companyListSchema,
  companySchema,
  type CompanyCreateRequest,
  type CompanyUpdateRequest,
} from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

export const companyKeys = {
  all: ['companies'] as const,
  list: ['companies', 'list'] as const,
  detail: (id: string) => ['companies', 'detail', id] as const,
};

export function useCompaniesQuery() {
  return useQuery({
    queryKey: companyKeys.list,
    queryFn: () => apiParsed(companyListSchema, endpoints.companies.list),
  });
}

export function useCompanyQuery(id: string) {
  return useQuery({
    queryKey: companyKeys.detail(id),
    queryFn: () => apiParsed(companySchema, endpoints.companies.one(id)),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: CompanyCreateRequest) => apiParsed(companySchema, endpoints.companies.list, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.all }),
  });
}

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: CompanyUpdateRequest) =>
      apiParsed(companySchema, endpoints.companies.one(id), { method: 'PATCH', body }),
    onSuccess: (company) => {
      queryClient.setQueryData(companyKeys.detail(id), company);
      void queryClient.invalidateQueries({ queryKey: companyKeys.all });
    },
  });
}
