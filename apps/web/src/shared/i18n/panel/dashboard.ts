export const dashboardTexts = {
  title: 'Painel',
  welcome: (name: string) => `Olá, ${name}.`,
  rangeLabel: 'Últimos 30 dias',
  metrics: {
    views: 'Visitas',
    clicks: 'Cliques',
    vcfDownloads: 'Contactos guardados',
    contactsSent: 'Contactos enviados',
  },
  shortcutsTitle: 'Ações rápidas',
  shortcuts: {
    sendContact: 'Enviar contacto',
    cards: 'Cartões',
    profiles: 'Perfis',
    members: 'Membros',
    companies: 'Empresas',
    analytics: 'Estatísticas',
    audit: 'Auditoria',
    account: 'Conta',
  },
} as const;
