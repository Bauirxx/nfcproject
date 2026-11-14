import type { AuditAction } from '@nfc-business/shared/constants';

export const auditActionLabels: Record<AuditAction, string> = {
  'auth.login': 'Início de sessão',
  'auth.login_failed': 'Início de sessão falhado',
  'auth.logout': 'Fim de sessão',
  'auth.mfa_enabled': 'MFA ativado',
  'auth.password_changed': 'Palavra-passe alterada',
  'auth.sessions_revoked': 'Sessões terminadas',
  'company.created': 'Empresa criada',
  'company.updated': 'Empresa atualizada',
  'member.invited': 'Membro convidado',
  'member.role_changed': 'Papel de membro alterado',
  'member.removed': 'Membro removido',
  'card.created': 'Cartão criado',
  'card.updated': 'Cartão atualizado',
  'card.activated': 'Cartão ativado',
  'card.deactivated': 'Cartão desativado',
  'card.lost': 'Cartão marcado como perdido',
  'card.blocked': 'Cartão bloqueado',
  'profile.created': 'Perfil criado',
  'profile.updated': 'Perfil atualizado',
  'contact.sent': 'Contacto enviado',
};

export const auditTexts = {
  title: 'Auditoria',
  description: 'Registo das ações importantes, mais recentes primeiro.',
  filters: {
    action: 'Ação',
    allActions: 'Todas as ações',
    actor: 'Autor',
    actorPlaceholder: 'Nome ou email',
    from: 'De',
    to: 'Até',
  },
  columns: {
    action: 'Ação',
    actor: 'Autor',
    target: 'Alvo',
    company: 'Empresa',
    date: 'Data',
  },
  noTarget: '—',
  noCompany: '—',
  empty: {
    title: 'Sem registos',
    description: 'Ainda não há ações registadas.',
    filtered: 'Nenhum registo corresponde aos filtros.',
  },
} as const;
