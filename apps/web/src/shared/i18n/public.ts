// Textos da página pública do cartão. Sem dependências: entra no carregamento inicial (ADR-0003).
export const publicTexts = {
  loading: 'A carregar o cartão…',
  unavailable: {
    title: 'Cartão indisponível',
    body: 'Este cartão não está disponível de momento.',
  },
  photoAlt: (name: string) => `Fotografia de ${name}`,
  logoAlt: 'Logótipo',
  actionsHeading: 'Contactos',
  actions: {
    saveContact: 'Guardar contacto',
    call: 'Ligar',
    whatsapp: 'WhatsApp',
    email: 'Email',
    website: 'Website',
    location: 'Localização',
  },
  socialHeading: 'Redes sociais',
  newTab: '(abre num novo separador)',
  share: {
    button: 'Partilhar',
    title: (name: string) => `Cartão de visita de ${name}`,
    copied: 'Link copiado.',
    failed: 'Não foi possível copiar. Copie o endereço a partir do browser.',
  },
  qr: {
    show: 'Mostrar QR Code',
    hide: 'Esconder QR Code',
    loading: 'A gerar o QR Code…',
    alt: (name: string) => `QR Code do cartão de ${name}`,
    hint: 'Aponte a câmara de outro telemóvel para abrir este cartão.',
    failed: 'Não foi possível gerar o QR Code.',
  },
  owner: {
    send: 'Enviar o meu contacto',
    close: 'Fechar',
    loading: 'A carregar…',
    failed: 'Não foi possível abrir o envio. Tente novamente.',
    panel: 'Abrir o painel',
  },
  footer: 'Cartão de visita digital · NFC Business',
} as const;
