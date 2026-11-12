import type { CardStatus, CardHistoryAction } from '@nfc-business/shared/constants';

export const cardStatusLabels: Record<CardStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  lost: 'Perdido',
  blocked: 'Bloqueado',
};

export const cardHistoryLabels: Record<CardHistoryAction, string> = {
  created: 'Cartão criado',
  updated: 'Cartão atualizado',
  profile_linked: 'Perfil associado',
  profile_unlinked: 'Perfil desassociado',
  activated: 'Ativado',
  deactivated: 'Desativado',
  lost: 'Marcado como perdido',
  blocked: 'Bloqueado',
};

export const cardTexts = {
  title: 'Cartões',
  description: 'Faça a gestão dos cartões NFC da sua empresa.',
  searchPlaceholder: 'Procurar por nome ou perfil',
  searchLabel: 'Procurar cartões',
  statusLabel: 'Estado',
  statusAll: 'Todos os estados',
  columns: {
    label: 'Cartão',
    status: 'Estado',
    profile: 'Perfil',
    updated: 'Atualizado',
    actions: 'Ações',
  },
  noProfile: 'Sem perfil',
  open: 'Abrir',
  empty: {
    title: 'Ainda não há cartões',
    description: 'Crie o primeiro cartão para o associar a um perfil.',
    filtered: 'Nenhum cartão corresponde à pesquisa.',
  },
  create: {
    button: 'Criar cartão',
    title: 'Novo cartão',
    submit: 'Criar',
  },
  fields: {
    label: 'Nome do cartão',
    labelHint: 'Um nome interno para identificar o cartão (por exemplo, «Paula · principal»).',
    profile: 'Perfil associado',
    profileNone: 'Sem perfil por agora',
  },
  detail: {
    back: 'Voltar aos cartões',
    chipUrl: 'Endereço do chip',
    chipUrlHint: 'É este o endereço gravado no chip NFC e no QR Code. Não muda quando o perfil é editado.',
    copy: 'Copiar endereço',
    copied: 'Endereço copiado.',
    qrTitle: 'QR Code',
    qrAlt: (label: string) => `QR Code do cartão ${label}`,
    downloadPng: 'Transferir PNG',
    downloadSvg: 'Transferir SVG',
    profileSection: 'Perfil',
    changeProfile: 'Alterar perfil',
    saveProfile: 'Guardar',
    historyTitle: 'Histórico',
    historyEmpty: 'Sem registos.',
    statusSection: 'Estado do cartão',
  },
  actions: {
    activate: 'Ativar',
    deactivate: 'Desativar',
    lost: 'Marcar como perdido',
    block: 'Bloquear',
  },
  confirm: {
    deactivate: {
      title: 'Desativar o cartão?',
      body: 'O cartão deixa de abrir a página pública até ser ativado de novo.',
    },
    lost: {
      title: 'Marcar o cartão como perdido?',
      body: 'A página pública fica indisponível. Pode reativar o cartão mais tarde se o recuperar.',
    },
    block: {
      title: 'Bloquear o cartão?',
      body: 'O bloqueio é definitivo: o cartão não volta a funcionar. Use-o se o cartão foi perdido ou comprometido.',
    },
  },
} as const;
