import type { AnalyticsSummary, AnalyticsTotals } from '@nfc-business/shared/schemas';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePermission } from '@/app/session';
import { Button } from '@/shared/components/ui/button';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { analyticsMetricLabels, analyticsTexts } from '@/shared/i18n/panel/analytics';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { buildCsv } from '@/shared/lib/csv';
import { downloadText } from '@/shared/lib/download';
import { recentRange, useAnalyticsSummaryQuery } from './queries';
import { MetricLineChart } from './metric-line-chart';

const PERIODS = [7, 30, 90] as const;
const METRICS: ReadonlyArray<keyof AnalyticsTotals> = ['views', 'clicks', 'vcfDownloads', 'contactsSent'];

export function StatsPage() {
  useDocumentTitle(analyticsTexts.title);
  const canFilterByCompany = usePermission('analytics.filterByCompany');
  const [days, setDays] = useState(30);
  const [companyId, setCompanyId] = useState('');
  const [cardId, setCardId] = useState('');
  const range = useMemo(() => recentRange(days), [days]);

  // Resumo sem filtro de cartão: alimenta a tabela, as opções de cartão e de empresa.
  const base = useAnalyticsSummaryQuery({ ...range, companyId: companyId || undefined });
  // Resumo dos gráficos: igual ao de cima quando não há cartão escolhido (mesma chave, sem pedido extra).
  const charted = useAnalyticsSummaryQuery({ ...range, companyId: companyId || undefined, cardId: cardId || undefined });

  function exportCsv(summary: AnalyticsSummary) {
    const headers = [
      analyticsTexts.table.card,
      analyticsTexts.table.profile,
      ...METRICS.map((metric) => analyticsMetricLabels[metric]),
    ];
    const rows = summary.byCard.map((row) => [
      row.cardLabel,
      row.profileName ?? analyticsTexts.table.noProfile,
      ...METRICS.map((metric) => row[metric]),
    ]);
    downloadText(buildCsv(headers, rows), `estatisticas-${range.from}_${range.to}.csv`, 'text/csv;charset=utf-8');
  }

  return (
    <section>
      <PageHeader
        title={analyticsTexts.title}
        description={analyticsTexts.description}
        actions={
          base.data ? (
            <Button variant="outline" onClick={() => exportCsv(base.data)}>
              <Download aria-hidden="true" />
              {analyticsTexts.export}
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="sm:w-48">
          <SelectField
            label={analyticsTexts.periodLabel}
            hideOptional
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {PERIODS.map((value) => (
              <option key={value} value={value}>
                {analyticsTexts.periods[value]}
              </option>
            ))}
          </SelectField>
        </div>

        {canFilterByCompany ? (
          <div className="sm:w-56">
            <SelectField
              label={analyticsTexts.companyLabel}
              hideOptional
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setCardId('');
              }}
            >
              <option value="">{analyticsTexts.allCompanies}</option>
              {(base.data?.byCompany ?? []).map((company) => (
                <option key={company.companyId} value={company.companyId}>
                  {company.companyName}
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}

        <div className="sm:w-64">
          <SelectField
            label={analyticsTexts.cardLabel}
            hideOptional
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
          >
            <option value="">{analyticsTexts.allCards}</option>
            {(base.data?.byCard ?? []).map((card) => (
              <option key={card.cardId} value={card.cardId}>
                {card.cardLabel}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {charted.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={analyticsTexts.title} />
        </div>
      ) : charted.isError ? (
        <ErrorState error={charted.error} onRetry={() => void charted.refetch()} />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {METRICS.map((metric) => (
              <MetricLineChart
                key={metric}
                title={analyticsMetricLabels[metric]}
                dates={charted.data.series.map((point) => point.date)}
                values={charted.data.series.map((point) => point[metric])}
                total={charted.data.totals[metric]}
              />
            ))}
          </div>

          <h2 className="mb-3 mt-8 text-lg font-semibold">{analyticsTexts.table.title}</h2>
          {base.data && base.data.byCard.length > 0 ? (
            <Table>
              <THead>
                <Tr>
                  <Th>{analyticsTexts.table.card}</Th>
                  <Th>{analyticsTexts.table.profile}</Th>
                  {METRICS.map((metric) => (
                    <Th key={metric} className="text-right">
                      {analyticsMetricLabels[metric]}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {base.data.byCard.map((row) => (
                  <Tr key={row.cardId}>
                    <Td className="font-medium">{row.cardLabel}</Td>
                    <Td className="text-muted-foreground">{row.profileName ?? analyticsTexts.table.noProfile}</Td>
                    {METRICS.map((metric) => (
                      <Td key={metric} className="text-right tabular-nums">
                        {row[metric]}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {analyticsTexts.table.empty}
            </p>
          )}
        </>
      )}
    </section>
  );
}
