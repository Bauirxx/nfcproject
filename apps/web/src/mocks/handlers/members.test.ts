import type { Member, MemberList } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '../credentials';
import { getDb } from '../db';
import { memberHandlers } from './members';
import { api, errorCode, readJson, signIn, useMockServer } from './testing';

useMockServer(memberHandlers);

describe('GET /api/members', () => {
  it('só company_admin acede', async () => {
    expect((await api('GET', '/api/members')).status).toBe(401);
    for (const userId of ['u_edu', 'u_paula', 'u_marta']) {
      signIn(userId);
      const response = await api('GET', '/api/members');
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe('forbidden');
    }
  });

  it('lista só os membros da empresa da sessão, do mais antigo para o mais recente', async () => {
    signIn('u_ana');
    const response = await api('GET', '/api/members');
    expect(response.status).toBe(200);
    const { items } = await readJson<MemberList>(response);
    expect(items.map((member) => member.id)).toEqual(['u_ana', 'u_edu', 'u_paula', 'u_carlos', 'u_convidado']);
    expect(items[4]).toMatchObject({ name: null, email: 'convidado@acme.test', role: 'profile_owner', status: 'invited' });
    expect(items.some((member) => member.email.endsWith('@beta.test'))).toBe(false);
  });
});

describe('POST /api/members', () => {
  it('convida um novo membro com o papel indicado e regista na auditoria', async () => {
    signIn('u_ana');
    const response = await api('POST', '/api/members', { email: 'Nova.Pessoa@Acme.test', role: 'company_editor' });
    expect(response.status).toBe(201);
    const member = await readJson<Member>(response);
    expect(member).toMatchObject({ name: null, email: 'nova.pessoa@acme.test', role: 'company_editor', status: 'invited' });

    const db = getDb();
    expect(db.users.find((user) => user.id === member.id)).toMatchObject({ companyId: 'co_acme', password: null });
    expect(Object.values(db.inviteTokens).some((token) => token.userId === member.id)).toBe(true);
    expect(db.audit[0]).toMatchObject({ action: 'member.invited', target: 'nova.pessoa@acme.test', companyId: 'co_acme' });
  });

  it('não convida emails que já têm conta, mesmo noutra empresa', async () => {
    signIn('u_ana');
    for (const email of ['edu.editor@acme.test', 'convidado@acme.test', 'rita.owner@beta.test']) {
      const response = await api('POST', '/api/members', { email, role: 'profile_owner' });
      expect(response.status).toBe(409);
      expect(await errorCode(response)).toBe('already_member');
    }
  });

  it('só aceita papéis de membro', async () => {
    signIn('u_ana');
    expect((await api('POST', '/api/members', { email: 'x@acme.test', role: 'platform_admin' })).status).toBe(422);
    expect((await api('POST', '/api/members', { email: 'sem-arroba', role: 'profile_owner' })).status).toBe(422);
  });
});

describe('PATCH /api/members/:id', () => {
  it('altera o papel de outro membro e regista na auditoria', async () => {
    signIn('u_ana');
    const response = await api('PATCH', '/api/members/u_edu', { role: 'company_admin' });
    expect(response.status).toBe(200);
    expect((await readJson<Member>(response)).role).toBe('company_admin');
    expect(getDb().users.find((user) => user.id === 'u_edu')?.role).toBe('company_admin');
    expect(getDb().audit[0]).toMatchObject({ action: 'member.role_changed', target: 'edu.editor@acme.test' });
  });

  it('não deixa o próprio mudar o seu papel', async () => {
    signIn('u_ana');
    const response = await api('PATCH', '/api/members/u_ana', { role: 'company_editor' });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe('cannot_change_self');
    expect(getDb().users.find((user) => user.id === 'u_ana')?.role).toBe('company_admin');
  });

  it('responde 404 a membros de outra empresa e a utilizadores desconhecidos', async () => {
    signIn('u_ana');
    for (const id of ['u_rita', 'u_nelson', 'u_marta', 'u_inexistente']) {
      const response = await api('PATCH', `/api/members/${id}`, { role: 'profile_owner' });
      expect(response.status).toBe(404);
      expect(await errorCode(response)).toBe('not_found');
    }
    expect(getDb().users.find((user) => user.id === 'u_rita')?.role).toBe('profile_owner');
  });
});

describe('DELETE /api/members/:id', () => {
  it('remove o membro, termina as suas sessões e liberta os perfis de que era dono', async () => {
    signIn('u_ana');
    getDb().sessions.push({ id: 's_carlos', userId: 'u_carlos', device: 'Chrome em Android', createdAt: '', lastSeenAt: '' });
    expect((await api('DELETE', '/api/members/u_carlos')).status).toBe(204);

    const db = getDb();
    expect(db.users.some((user) => user.id === 'u_carlos')).toBe(false);
    expect(db.sessions.some((session) => session.userId === 'u_carlos')).toBe(false);
    expect(db.profiles.find((profile) => profile.id === 'p_carlos')?.ownerUserId).toBeNull();
    expect(db.audit[0]).toMatchObject({ action: 'member.removed', target: 'carlos.owner@acme.test' });
    // A sessão da Ana continua.
    expect((await api('GET', '/api/members')).status).toBe(200);
  });

  it('remover um convidado invalida o convite', async () => {
    signIn('u_ana');
    expect((await api('DELETE', '/api/members/u_convidado')).status).toBe(204);
    expect(getDb().inviteTokens[MOCK_TOKENS.invite]).toBeUndefined();
  });

  it('não deixa o próprio remover-se nem remover membros de outra empresa', async () => {
    signIn('u_ana');
    const self = await api('DELETE', '/api/members/u_ana');
    expect(self.status).toBe(409);
    expect(await errorCode(self)).toBe('cannot_change_self');
    expect((await api('DELETE', '/api/members/u_rita')).status).toBe(404);
    expect(getDb().users.some((user) => user.id === 'u_rita')).toBe(true);
  });
});
