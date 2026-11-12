// Matriz de permissões por papel. No frontend serve apenas a usabilidade (esconder menus e ações);
// o controlo de acesso real é sempre do backend.
import { MFA_REQUIRED_ROLES, type Role } from './constants';

export const PERMISSIONS = [
  'dashboard.view',
  'companies.manage',
  'members.manage',
  'cards.view',
  'cards.manage',
  'profiles.view',
  'profiles.create',
  'profiles.edit',
  'profiles.assignOwner',
  'contact.send',
  'themes.manage',
  'analytics.view',
  'analytics.filterByCompany',
  'audit.view',
  'account.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  platform_admin: [
    'dashboard.view',
    'companies.manage',
    'analytics.view',
    'analytics.filterByCompany',
    'audit.view',
    'account.manage',
  ],
  company_admin: [
    'dashboard.view',
    'members.manage',
    'cards.view',
    'cards.manage',
    'profiles.view',
    'profiles.create',
    'profiles.edit',
    'profiles.assignOwner',
    'contact.send',
    'themes.manage',
    'analytics.view',
    'audit.view',
    'account.manage',
  ],
  company_editor: [
    'dashboard.view',
    'cards.view',
    'cards.manage',
    'profiles.view',
    'profiles.create',
    'profiles.edit',
    'contact.send',
    'themes.manage',
    'analytics.view',
    'account.manage',
  ],
  profile_owner: ['dashboard.view', 'profiles.view', 'profiles.edit', 'contact.send', 'analytics.view', 'account.manage'],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function permissionsOf(role: Role): readonly Permission[] {
  return MATRIX[role];
}

export function requiresMfa(role: Role): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
