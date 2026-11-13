import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { analyticsSummarySchema } from '@nfc-business/shared/schemas';
import { endpoints } from '@/shared/api/endpoints';
import { apiParsed } from '@/shared/lib/parsed-api';

export type AnalyticsSummaryParams = {
  from: string;
  to: string;
  cardId?: string | undefined;
  companyId?: string | undefined;
};

export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: (params: AnalyticsSummaryParams) => ['analytics', 'summary', params] as const,
};

export function useAnalyticsSummaryQuery(params: AnalyticsSummaryParams) {
  return useQuery({
    queryKey: analyticsKeys.summary(params),
    queryFn: () => apiParsed(analyticsSummarySchema, endpoints.analytics.summary, { query: params }),
    placeholderData: keepPreviousData,
  });
}

/** Intervalo civil dos últimos `days` dias (inclusive), em `AAAA-MM-DD`. */
export function recentRange(days: number, today: Date = new Date()): { from: string; to: string } {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const civil = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: civil(from), to: civil(today) };
}
