import type { ShareChannel } from '@nfc-business/shared/constants';

export const shareChannelLabels: Record<ShareChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

export const contactTexts = {
  title: 'Enviar contacto',
  description: 'Envie os dados do cartão a um cliente que não está a ler o NFC ou o QR Code.',
  form: {
    profileLabel: 'Perfil a partilhar',
    profileHint: 'O contacto partilhado é o deste perfil.',
    recipientNameLabel: 'Nome do destinatário',
    channelLabel: 'Canal',
    emailLabel: 'Email do destinatário',
    phoneLabel: 'Número do destinatário',
    phoneHint: 'Com indicativo. Sem indicativo, assume-se +258 (Moçambique).',
    noteLabel: 'Nota pessoal',
    noteHint: 'Até 200 caracteres, sem links. Juntada à mensagem.',
    previewTitle: 'Pré-visualização da mensagem',
    submit: {
      email: 'Enviar por email',
      whatsapp: 'Abrir no WhatsApp',
      sms: 'Abrir SMS',
    } satisfies Record<ShareChannel, string>,
    sent: {
      email: 'Email enviado ao destinatário.',
      whatsapp: 'Envio registado. Abrimos o WhatsApp com a mensagem.',
      sms: 'Envio registado. Abrimos a aplicação de SMS.',
    } satisfies Record<ShareChannel, string>,
  },
  empty: {
    title: 'Nenhum perfil pronto para partilhar',
    description: 'O envio precisa de um perfil com um cartão ativo. Ative um cartão associado a um perfil.',
  },
  history: {
    title: 'Envios recentes',
    description: 'O destinatário aparece mascarado e é eliminado automaticamente ao fim de 90 dias.',
    columns: {
      recipient: 'Destinatário',
      channel: 'Canal',
      profile: 'Perfil',
      date: 'Data',
    },
    empty: 'Ainda não há envios.',
    allProfiles: 'Todos os perfis',
    filterLabel: 'Filtrar por perfil',
  },
} as const;
