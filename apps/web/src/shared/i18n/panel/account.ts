import type { Role } from '@nfc-business/shared/constants';

export const roleLabels: Record<Role, string> = {
  platform_admin: 'Administrador da plataforma',
  company_admin: 'Administrador da empresa',
  company_editor: 'Editor',
  profile_owner: 'Dono de perfil',
};

export const accountTexts = {
  title: 'Conta',
  description: 'Os seus dados, a palavra-passe, a verificação em dois passos e as sessões ativas.',
  details: {
    title: 'Dados pessoais',
    name: 'Nome',
    email: 'Email',
    emailHint: 'O email é o identificador da conta e não pode ser alterado aqui.',
    role: 'Papel',
    company: 'Empresa',
    submit: 'Guardar',
    saved: 'Dados guardados.',
  },
  password: {
    title: 'Palavra-passe',
    current: 'Palavra-passe atual',
    next: 'Nova palavra-passe',
    confirm: 'Confirmar a nova palavra-passe',
    submit: 'Alterar a palavra-passe',
    saved: 'Palavra-passe alterada.',
  },
  mfa: {
    title: 'Verificação em dois passos',
    enabled: 'Ativa. A conta pede um código da aplicação de autenticação ao entrar.',
    disabled: 'Inativa. Recomendamos ativá-la para proteger a conta.',
    required: 'Obrigatória para o seu papel; não pode ser desativada.',
    enable: 'Ativar a verificação em dois passos',
    disable: 'Desativar',
    disableTitle: 'Desativar a verificação em dois passos?',
    disableBody: 'Confirme com a sua palavra-passe atual. A conta fica menos protegida.',
    disablePassword: 'Palavra-passe atual',
    disabledOk: 'Verificação em dois passos desativada.',
  },
  sessions: {
    title: 'Sessões ativas',
    description: 'Os dispositivos com sessão iniciada na sua conta.',
    current: 'Esta sessão',
    lastSeen: (when: string) => `Última atividade: ${when}`,
    empty: 'Não há outras sessões.',
    endAll: 'Terminar todas as sessões',
    endAllTitle: 'Terminar todas as sessões?',
    endAllBody: 'Todas as sessões terminam, incluindo esta. Terá de entrar novamente.',
    endAllConfirm: 'Terminar todas',
  },
} as const;
