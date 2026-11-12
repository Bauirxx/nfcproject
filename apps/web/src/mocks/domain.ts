// Regras de domínio partilhadas pelos handlers da API simulada.
import type { AuditAction } from '@nfc-business/shared/constants';
import { requiresMfa } from '@nfc-business/shared/permissions';
import type { SessionUser } from '@nfc-business/shared/schemas';
import { nextId, randomToken, type DbCard, type DbUser, type MockDb } from './db';

/** Validade do access token (CLAUDE.md, regra 1). */
export const ACCESS_TOKEN_TTL = 15 * 60_000;

export function isoNow(): string {
  return new Date().toISOString();
}

/** Data civil local `AAAA-MM-DD`, a mesma que a interface usa nos intervalos das estatísticas. */
export function civilDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function companyName(db: MockDb, companyId: string | null): string | null {
  if (companyId === null) return null;
  return db.companies.find((company) => company.id === companyId)?.name ?? null;
}

export function toSessionUser(db: MockDb, user: DbUser): SessionUser {
  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: companyName(db, user.companyId),
    mfaEnabled: user.totpSecret !== null,
    mfaRequired: requiresMfa(user.role),
  };
}

/** Acrescenta uma entrada à auditoria, que fica ordenada da mais recente para a mais antiga. */
export function recordAudit(
  db: MockDb,
  actor: DbUser,
  action: AuditAction,
  target: string | null = null,
  companyId: string | null = actor.companyId,
): void {
  db.audit.unshift({
    id: nextId('a'),
    action,
    actorName: actor.name ?? actor.email,
    actorEmail: actor.email,
    target,
    companyId,
    createdAt: isoNow(),
  });
}

/** Cartão ativo usado nos links de partilha de um perfil. */
export function activeCardOf(db: MockDb, profileId: string): DbCard | undefined {
  return db.cards.find((card) => card.profileId === profileId && card.status === 'active');
}

/** Resumo do dispositivo, como o backend o devolveria: «Chrome em Android». */
export function describeDevice(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const system = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iPhone'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return system ? `${browser} em ${system}` : browser;
}

/** Cria a sessão: novos «cookies» e novo token CSRF. */
export function startSession(db: MockDb, user: DbUser): void {
  const now = isoNow();
  const session = {
    id: nextId('s'),
    userId: user.id,
    device: describeDevice(navigator.userAgent),
    createdAt: now,
    lastSeenAt: now,
  };
  db.sessions.push(session);
  db.cookies = { sessionId: session.id, accessExpiresAt: Date.now() + ACCESS_TOKEN_TTL, mfaPendingUserId: null };
  db.csrfToken = randomToken(24);
  recordAudit(db, user, 'auth.login');
}

/** Termina a sessão deste browser (logout): remove-a da lista, limpa os «cookies» e muda o token CSRF. */
export function endCurrentSession(db: MockDb): void {
  const current = db.cookies.sessionId;
  if (current !== null) db.sessions = db.sessions.filter((session) => session.id !== current);
  db.cookies = { sessionId: null, accessExpiresAt: 0, mfaPendingUserId: null };
  db.csrfToken = randomToken(24);
}

/** Termina as sessões de um utilizador; `exceptSessionId` mantém uma (por exemplo, a atual). */
export function endSessions(db: MockDb, userId: string, exceptSessionId: string | null = null): void {
  db.sessions = db.sessions.filter((session) => session.userId !== userId || session.id === exceptSessionId);
  const current = db.cookies.sessionId;
  if (current !== null && !db.sessions.some((session) => session.id === current)) endCurrentSession(db);
}
