// Páginas de erro do painel (RF-FE-21): cada uma tem título, explicação e uma ação de saída.
export const errorPageTexts = {
  forbidden: {
    title: 'Sem permissão',
    body: 'Não tem permissão para ver esta página. Se precisar de acesso, fale com um administrador.',
    action: 'Ir para o painel',
  },
  notFound: {
    title: 'Página não encontrada',
    body: 'A página que procura não existe ou foi movida.',
    action: 'Ir para o painel',
  },
  serverError: {
    title: 'Algo correu mal',
    body: 'Ocorreu um erro inesperado. Tente novamente dentro de momentos.',
    action: 'Recarregar',
  },
  sessionExpired: {
    title: 'A sua sessão terminou',
    body: 'Por segurança, a sua sessão foi fechada. Inicie sessão novamente para continuar.',
    action: 'Iniciar sessão',
  },
} as const;
