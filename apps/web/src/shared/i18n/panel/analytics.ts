import type { AnalyticsTotals } from '@nfc-business/shared/schemas';

export const analyticsMetricLabels: Record<keyof AnalyticsTotals, string> = {
  views: 'Visitas',
  clicks: 'Cliques',
  vcfDownloads: 'Contactos guardados',
  contactsSent: 'Contactos enviados',
};

export const analyticsTexts = {
  title: 'Estatísticas',
  description: 'Visitas, cliques, contactos guardados e contactos enviados ao longo do tempo.',
  periodLabel: 'Período',
  periods: {
    7: 'Últimos 7 dias',
    30: 'Últimos 30 dias',
    90: 'Últimos 90 dias',
  } as Record<number, string>,
  cardLabel: 'Cartão',
  allCards: 'Todos os cartões',
  companyLabel: 'Empresa',
  allCompanies: 'Todas as empresas',
  export: 'Exportar CSV',
  chart: {
    summaryAria: (metric: string, from: string, to: string, max: number) =>
      `${metric} por dia, de ${from} a ${to}. Máximo diário: ${max}.`,
    point: (date: string, value: number) => `${date}: ${value}`,
  },
  table: {
    title: 'Por cartão',
    card: 'Cartão',
    profile: 'Perfil',
    noProfile: '—',
    empty: 'Sem atividade no período.',
  },
} as const;
