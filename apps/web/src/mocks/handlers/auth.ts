// Handlers de autenticação e conta da API simulada (ADR-0004 e ADR-0005; CLAUDE.md, regra 1).
import type { HttpHandler } from 'msw';
import { requiresMfa } from '@nfc-business/shared/permissions';
import {
  accountUpdateRequestSchema,
  inviteAcceptRequestSchema,
  loginRequestSchema,
  mfaConfirmRequestSchema,
  mfaDisableRequestSchema,
  mfaVerifyRequestSchema,
  passwordChangeRequestSchema,
  recoverConfirmRequestSchema,
  recoverRequestSchema,
  type AuthSession,
  type LoginResponse,
  type MfaConfirmResponse,
  type MfaSetupResponse,
  type MfaVerifyResponse,
  type SessionResponse,
} from '@nfc-business/shared/schemas';
import { MOCK_BREACHED_PASSWORDS } from '../credentials';
import { randomToken, type DbOneTimeToken, type DbSession, type DbUser, type MockDb } from '../db';
import {
  ACCESS_TOKEN_TTL,
  endCurrentSession,
  endSessions,
  isoNow,
  recordAudit,
  startSession,
  toSessionUser,
} from '../domain';
import { randomTotpSecret, verifyTotp } from '../totp';
import { fail, hitLimit, json, noContent, readBody, requirePermission, requireUser, route, sessionUser } from './http';

/** 5 tentativas por minuto por email no login e na recuperação (CLAUDE.md, regra 1); o mesmo no segundo passo. */
const ATTEMPTS_MAX = 5;
const ATTEMPTS_WINDOW_MS = 60_000;
/** Link de recuperação válido durante 1 hora (CLAUDE.md, regra 1). */
const RESET_TOKEN_TTL_MS = 3_600_000;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_ISSUER = 'NFC Business';

function currentSession(db: MockDb): DbSession | null {
  return db.sessions.find((session) => session.id === db.cookies.sessionId) ?? null;
}

function activeUserById(db: MockDb, userId: string): DbUser | null {
  return db.users.find((user) => user.id === userId && user.status === 'active') ?? null;
}

/** Há refresh token válido: a sessão existe e o utilizador continua ativo. */
function canRefresh(db: MockDb): boolean {
  const session = currentSession(db);
  return session !== null && activeUserById(db, session.userId) !== null;
}

function isBreached(password: string): boolean {
  return MOCK_BREACHED_PASSWORDS.includes(password);
}

function limitAttempts(db: MockDb, key: string): void {
  const wait = hitLimit(db, key, ATTEMPTS_MAX, ATTEMPTS_WINDOW_MS);
  if (wait !== null) fail(429, 'rate_limited', { retryAfter: wait });
}

/** Utilizador de um link de uso único, ou 400 `invalid_token` se não existir, tiver expirado ou já tiver sido usado. */
function userOfOneTimeToken(
  store: Record<string, DbOneTimeToken>,
  token: string,
  db: MockDb,
  status: DbUser['status'],
): DbUser {
  const entry = store[token];
  if (!entry) fail(400, 'invalid_token');
  if (Date.parse(entry.expiresAt) <= Date.now()) {
    delete store[token];
    fail(400, 'invalid_token');
  }
  const user = db.users.find((candidate) => candidate.id === entry.userId && candidate.status === status);
  return user ?? fail(400, 'invalid_token');
}

function randomRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let code = '';
  bytes.forEach((byte, index) => {
    if (index === 5) code += '-';
    code += RECOVERY_ALPHABET.charAt(byte % RECOVERY_ALPHABET.length);
  });
  return code;
}

/** Código de recuperação de uso único: é removido ao ser aceite. */
function consumeRecoveryCode(user: DbUser, code: string): boolean {
  const index = user.recoveryCodes.indexOf(code);
  if (index < 0) return false;
  user.recoveryCodes.splice(index, 1);
  return true;
}

function otpauthUrl(email: string, secret: string): string {
  const issuer = encodeURIComponent(TOTP_ISSUER);
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export const authHandlers: HttpHandler[] = [
  // Sessão atual e token CSRF (ADR-0005). Para anónimos responde 200 com `user: null`.
  route('get', '/api/auth/session', ({ db }) => {
    const user = sessionUser(db);
    const body: SessionResponse = { user: user ? toSessionUser(db, user) : null, csrfToken: db.csrfToken };
    if (!user && canRefresh(db)) body.refreshable = true;
    return json(body);
  }),

  route('post', '/api/auth/login', async ({ db, request }) => {
    const { email, password } = await readBody(request, loginRequestSchema);
    limitAttempts(db, `login:${email}`);
    const user = db.users.find((candidate) => candidate.email === email && candidate.status === 'active');
    if (!user || user.password !== password) {
      if (user) recordAudit(db, user, 'auth.login_failed');
      // Mensagem genérica: não distingue email desconhecido de palavra-passe errada.
      fail(401, 'invalid_credentials');
    }
    // Uma sessão anterior neste browser é substituída.
    endCurrentSession(db);
    if (user.totpSecret !== null) {
      db.cookies.mfaPendingUserId = user.id;
      return json({ status: 'mfa_required' } satisfies LoginResponse);
    }
    startSession(db, user);
    return json({ status: 'authenticated', user: toSessionUser(db, user) } satisfies LoginResponse);
  }),

  route('post', '/api/auth/mfa/verify', async ({ db, request }) => {
    const body = await readBody(request, mfaVerifyRequestSchema);
    const pendingId = db.cookies.mfaPendingUserId;
    const user = pendingId === null ? null : activeUserById(db, pendingId);
    const secret = user?.totpSecret ?? null;
    if (!user || secret === null) fail(401, 'mfa_challenge_expired');
    limitAttempts(db, `mfa:${user.id}`);
    const valid = 'code' in body ? await verifyTotp(secret, body.code) : consumeRecoveryCode(user, body.recoveryCode);
    if (!valid) {
      recordAudit(db, user, 'auth.login_failed');
      fail(401, 'invalid_code');
    }
    startSession(db, user);
    return json({ user: toSessionUser(db, user) } satisfies MfaVerifyResponse);
  }),

  route('post', '/api/auth/logout', ({ db }) => {
    const user = sessionUser(db);
    if (user) recordAudit(db, user, 'auth.logout');
    endCurrentSession(db);
    return noContent();
  }),

  // Renova o access token com o refresh token (cookie restrito a /api/auth).
  route('post', '/api/auth/refresh', ({ db }) => {
    const session = currentSession(db);
    const user = session ? activeUserById(db, session.userId) : null;
    if (!session || !user) {
      endCurrentSession(db);
      fail(401, 'unauthenticated');
    }
    db.cookies.accessExpiresAt = Date.now() + ACCESS_TOKEN_TTL;
    session.lastSeenAt = isoNow();
    return noContent();
  }),

  // Configuração de MFA: qualquer utilizador com sessão, incluindo administradores ainda sem MFA.
  route('post', '/api/auth/mfa/setup', ({ db }) => {
    const user = requireUser(db);
    if (user.totpSecret !== null) fail(409, 'mfa_already_enabled');
    const secret = randomTotpSecret();
    user.pendingTotpSecret = secret;
    return json({ secret, otpauthUrl: otpauthUrl(user.email, secret) } satisfies MfaSetupResponse);
  }),

  route('post', '/api/auth/mfa/confirm', async ({ db, request }) => {
    const user = requireUser(db);
    const { code } = await readBody(request, mfaConfirmRequestSchema);
    const pending = user.pendingTotpSecret;
    if (pending === null) fail(409, 'mfa_not_pending');
    if (!(await verifyTotp(pending, code))) fail(422, 'invalid_code');
    user.totpSecret = pending;
    user.pendingTotpSecret = null;
    user.recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
    recordAudit(db, user, 'auth.mfa_enabled');
    // Os códigos são mostrados uma única vez: a API nunca os volta a devolver.
    return json({ recoveryCodes: [...user.recoveryCodes] } satisfies MfaConfirmResponse);
  }),

  route('post', '/api/auth/mfa/disable', async ({ db, request }) => {
    const user = requireUser(db);
    const { password } = await readBody(request, mfaDisableRequestSchema);
    if (requiresMfa(user.role)) fail(403, 'mfa_required_for_role');
    if (user.password !== password) fail(422, 'invalid_current_password');
    if (user.totpSecret === null) fail(409, 'mfa_not_enabled');
    user.totpSecret = null;
    user.pendingTotpSecret = null;
    user.recoveryCodes = [];
    return noContent();
  }),

  // Responde sempre 202, exista ou não a conta (CLAUDE.md, regra 1). O email com o link não é simulado.
  route('post', '/api/auth/recover', async ({ db, request }) => {
    const { email } = await readBody(request, recoverRequestSchema);
    limitAttempts(db, `recover:${email}`);
    const user = db.users.find((candidate) => candidate.email === email && candidate.status === 'active');
    if (user) {
      db.resetTokens[randomToken(24)] = {
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
      };
    }
    return noContent(202);
  }),

  route('post', '/api/auth/recover/confirm', async ({ db, request }) => {
    const { token, password } = await readBody(request, recoverConfirmRequestSchema);
    const user = userOfOneTimeToken(db.resetTokens, token, db, 'active');
    // Com palavra-passe fraca o link continua válido para uma nova tentativa.
    if (isBreached(password)) fail(422, 'weak_password');
    user.password = password;
    delete db.resetTokens[token];
    recordAudit(db, user, 'auth.password_changed');
    // Termina todas as sessões ativas (CLAUDE.md, regra 1), incluindo a deste browser se for do mesmo utilizador.
    endSessions(db, user.id);
    return noContent();
  }),

  // Aceitar o convite ativa a conta mas não inicia sessão: o utilizador entra pelo login.
  route('post', '/api/auth/invite/accept', async ({ db, request }) => {
    const { token, name, password } = await readBody(request, inviteAcceptRequestSchema);
    const user = userOfOneTimeToken(db.inviteTokens, token, db, 'invited');
    if (isBreached(password)) fail(422, 'weak_password');
    user.name = name;
    user.password = password;
    user.status = 'active';
    delete db.inviteTokens[token];
    return noContent();
  }),

  // Conta: administradores sem MFA configurado ficam fora destes endpoints, como de todo o painel.
  route('patch', '/api/auth/account', async ({ db, request }) => {
    const user = requirePermission(db, 'account.manage');
    const { name } = await readBody(request, accountUpdateRequestSchema);
    user.name = name;
    return json(toSessionUser(db, user));
  }),

  route('post', '/api/auth/password', async ({ db, request }) => {
    const user = requirePermission(db, 'account.manage');
    const { currentPassword, newPassword } = await readBody(request, passwordChangeRequestSchema);
    if (user.password !== currentPassword) fail(422, 'invalid_current_password');
    if (isBreached(newPassword)) fail(422, 'weak_password');
    user.password = newPassword;
    recordAudit(db, user, 'auth.password_changed');
    return noContent();
  }),

  route('get', '/api/auth/sessions', ({ db }) => {
    const user = requirePermission(db, 'account.manage');
    const items: AuthSession[] = db.sessions
      .filter((session) => session.userId === user.id)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .map((session) => ({
        id: session.id,
        device: session.device,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        current: session.id === db.cookies.sessionId,
      }));
    return json({ items });
  }),

  // Termina todas as sessões, incluindo a atual.
  route('delete', '/api/auth/sessions', ({ db }) => {
    const user = requirePermission(db, 'account.manage');
    recordAudit(db, user, 'auth.sessions_revoked');
    endSessions(db, user.id);
    return noContent();
  }),
];
