import type { MemberRole } from '@nfc-business/shared/constants';

export const memberRoleLabels: Record<MemberRole, string> = {
  company_admin: 'Administrador',
  company_editor: 'Editor',
  profile_owner: 'Dono de perfil',
};

export const memberStatusLabels: Record<'active' | 'invited', string> = {
  active: 'Ativo',
  invited: 'Convidado',
};

export const memberTexts = {
  title: 'Membros',
  description: 'Faça a gestão das pessoas com acesso à sua empresa.',
  pending: 'Convite pendente',
  self: '(você)',
  columns: {
    member: 'Membro',
    role: 'Papel',
    status: 'Estado',
    actions: 'Ações',
  },
  empty: {
    title: 'Ainda não há membros',
    description: 'Convide a primeira pessoa para a sua empresa.',
  },
  roleLabel: 'Papel',
  invite: {
    button: 'Convidar membro',
    title: 'Convidar membro',
    submit: 'Enviar convite',
    emailLabel: 'Email',
    roleLabel: 'Papel',
    sent: 'Convite enviado.',
  },
  roleChanged: 'Papel atualizado.',
  remove: {
    action: 'Remover',
    title: 'Remover o membro?',
    body: (name: string) => `${name} deixa de ter acesso à empresa. Esta ação não pode ser anulada.`,
    confirm: 'Remover',
    removed: 'Membro removido.',
  },
} as const;
