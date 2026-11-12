// Handlers de membros da API simulada: company_admin gere os membros da sua empresa (FRONTEND «Membros»).
import type { HttpHandler } from 'msw';
import { MEMBER_ROLES, type MemberRole } from '@nfc-business/shared/constants';
import { memberInviteRequestSchema, memberUpdateRequestSchema, type Member } from '@nfc-business/shared/schemas';
import type { DbUser, MockDb } from '../db';
import { emailTaken, endSessions, inviteUser, recordAudit } from '../domain';
import { fail, json, noContent, readBody, requireCompany, requirePermission, route } from './http';

interface DbMember extends DbUser {
  role: MemberRole;
}

function isMemberOf(user: DbUser, companyId: string): user is DbMember {
  return user.companyId === companyId && (MEMBER_ROLES as readonly string[]).includes(user.role);
}

export function membersOf(db: MockDb, companyId: string): DbMember[] {
  return db.users.filter((user): user is DbMember => isMemberOf(user, companyId));
}

export function toMember(member: DbMember): Member {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt,
  };
}

/** Membro da empresa da sessão; qualquer outro utilizador dá 404 (CLAUDE.md, regra 2). */
function memberOr404(db: MockDb, companyId: string, id: string): DbMember {
  return membersOf(db, companyId).find((member) => member.id === id) ?? fail(404, 'not_found');
}

export const memberHandlers: HttpHandler[] = [
  route('get', '/api/members', ({ db }) => {
    const companyId = requireCompany(requirePermission(db, 'members.manage'));
    const items = membersOf(db, companyId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toMember);
    return json({ items });
  }),

  route('post', '/api/members', async ({ db, request }) => {
    const actor = requirePermission(db, 'members.manage');
    const companyId = requireCompany(actor);
    const { email, role } = await readBody(request, memberInviteRequestSchema);
    if (emailTaken(db, email)) fail(409, 'already_member');
    const member = inviteUser(db, email, role, companyId);
    recordAudit(db, actor, 'member.invited', email);
    return json(toMember(member), 201);
  }),

  // O próprio não muda o seu papel nem se remove: assim nunca fica uma empresa sem administrador.
  route('patch', '/api/members/:id', async ({ db, request, param }) => {
    const actor = requirePermission(db, 'members.manage');
    const member = memberOr404(db, requireCompany(actor), param('id'));
    const { role } = await readBody(request, memberUpdateRequestSchema);
    if (member.id === actor.id) fail(409, 'cannot_change_self');
    member.role = role;
    recordAudit(db, actor, 'member.role_changed', member.email);
    return json(toMember(member));
  }),

  route('delete', '/api/members/:id', ({ db, param }) => {
    const actor = requirePermission(db, 'members.manage');
    const member = memberOr404(db, requireCompany(actor), param('id'));
    if (member.id === actor.id) fail(409, 'cannot_change_self');
    db.users = db.users.filter((user) => user.id !== member.id);
    endSessions(db, member.id);
    for (const [token, entry] of Object.entries(db.inviteTokens)) {
      if (entry.userId === member.id) delete db.inviteTokens[token];
    }
    for (const profile of db.profiles) {
      if (profile.ownerUserId === member.id) profile.ownerUserId = null;
    }
    recordAudit(db, actor, 'member.removed', member.email);
    return noContent();
  }),
];
