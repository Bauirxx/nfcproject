// Autorização por papel (RBAC, CLAUDE.md regra 2) e contexto RLS a partir da sessão, nunca do cliente.
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { can, type Permission } from '@nfc-business/shared/permissions';
import type { DbContext } from '../database/database.service';
import type { AuthedRequest } from './auth.guard';
import type { SessionUser } from './session-user';

/** Utilizador da sessão com a permissão pedida; senão 403 `forbidden` (ou 401 sem sessão). */
export function requirePermission(req: AuthedRequest, permission: Permission): SessionUser {
  const user = req.user;
  if (!user) throw new UnauthorizedException({ error: { code: 'unauthenticated' } });
  if (!can(user.role, permission)) throw new ForbiddenException({ error: { code: 'forbidden' } });
  return user;
}

/** Contexto RLS da sessão: a empresa e o papel vêm sempre da sessão no servidor. */
export function dbContextOf(user: SessionUser): DbContext {
  return { companyId: user.companyId, isPlatformAdmin: user.role === 'platform_admin' };
}

/** Autor das entradas de auditoria a partir da sessão. */
export function auditActorOf(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: user.companyId,
    isPlatformAdmin: user.role === 'platform_admin',
  };
}
