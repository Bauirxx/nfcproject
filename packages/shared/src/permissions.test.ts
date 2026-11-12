import { describe, expect, it } from 'vitest';
import { CARD_STATUSES, CARD_TRANSITIONS, ROLES } from './constants';
import { PERMISSIONS, can, permissionsOf, requiresMfa } from './permissions';

describe('matriz de permissões', () => {
  it('só usa permissões conhecidas e todos os papéis têm painel e conta', () => {
    for (const role of ROLES) {
      for (const permission of permissionsOf(role)) {
        expect(PERMISSIONS).toContain(permission);
      }
      expect(can(role, 'dashboard.view')).toBe(true);
      expect(can(role, 'account.manage')).toBe(true);
    }
  });

  it('platform_admin gere empresas, mas não cartões nem membros de uma empresa', () => {
    expect(can('platform_admin', 'companies.manage')).toBe(true);
    expect(can('platform_admin', 'analytics.filterByCompany')).toBe(true);
    expect(can('platform_admin', 'audit.view')).toBe(true);
    expect(can('platform_admin', 'cards.manage')).toBe(false);
    expect(can('platform_admin', 'members.manage')).toBe(false);
  });

  it('company_admin gere membros, cartões, perfis e vê a auditoria', () => {
    expect(can('company_admin', 'members.manage')).toBe(true);
    expect(can('company_admin', 'cards.manage')).toBe(true);
    expect(can('company_admin', 'profiles.assignOwner')).toBe(true);
    expect(can('company_admin', 'audit.view')).toBe(true);
    expect(can('company_admin', 'companies.manage')).toBe(false);
  });

  it('company_editor não gere membros nem vê a auditoria', () => {
    expect(can('company_editor', 'cards.manage')).toBe(true);
    expect(can('company_editor', 'profiles.edit')).toBe(true);
    expect(can('company_editor', 'members.manage')).toBe(false);
    expect(can('company_editor', 'audit.view')).toBe(false);
    expect(can('company_editor', 'profiles.assignOwner')).toBe(false);
  });

  it('profile_owner edita o seu perfil e envia o contacto, sem gerir cartões', () => {
    expect(can('profile_owner', 'profiles.edit')).toBe(true);
    expect(can('profile_owner', 'contact.send')).toBe(true);
    expect(can('profile_owner', 'cards.view')).toBe(false);
    expect(can('profile_owner', 'profiles.create')).toBe(false);
    expect(can('profile_owner', 'themes.manage')).toBe(false);
  });

  it('só platform_admin vê empresas e filtra por empresa', () => {
    for (const role of ROLES.filter((r) => r !== 'platform_admin')) {
      expect(can(role, 'companies.manage')).toBe(false);
      expect(can(role, 'analytics.filterByCompany')).toBe(false);
    }
  });
});

describe('requiresMfa', () => {
  it('é obrigatório para administradores', () => {
    expect(requiresMfa('platform_admin')).toBe(true);
    expect(requiresMfa('company_admin')).toBe(true);
    expect(requiresMfa('company_editor')).toBe(false);
    expect(requiresMfa('profile_owner')).toBe(false);
  });
});

describe('transições de estado do cartão', () => {
  it('cobre todos os estados e blocked é terminal', () => {
    expect(Object.keys(CARD_TRANSITIONS).sort()).toEqual([...CARD_STATUSES].sort());
    expect(CARD_TRANSITIONS.blocked).toEqual([]);
  });

  it('nenhum estado permite a ação que leva ao próprio estado', () => {
    expect(CARD_TRANSITIONS.active).not.toContain('activate');
    expect(CARD_TRANSITIONS.inactive).not.toContain('deactivate');
    expect(CARD_TRANSITIONS.lost).not.toContain('lost');
  });
});
