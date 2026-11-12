import type { AuthSessionList, LoginResponse, SessionResponse, SessionUser } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { MOCK_RECOVERY_CODES, MOCK_TOKENS, MOCK_USERS } from '../credentials';
import { getDb } from '../db';
import { generateTotp } from '../totp';
import { authHandlers } from './auth';
import { api, errorCode, readJson, signIn, useMockServer } from './testing';

useMockServer(authHandlers);

const STRONG_PASSWORD = 'NovaPalavra#2026';

function session(): Promise<SessionResponse> {
  return api('GET', '/api/auth/session').then((response) => readJson<SessionResponse>(response));
}

function login(email: string, password: string): Promise<Response> {
  return api('POST', '/api/auth/login', { email, password });
}

function recentAuditActions(): string[] {
  return getDb().audit.slice(0, 3).map((entry) => entry.action);
}

describe('GET /api/auth/session', () => {
  it('devolve utilizador nulo e token CSRF para anónimos', async () => {
    const body = await session();
    expect(body.user).toBeNull();
    expect(body.csrfToken).toBe(getDb().csrfToken);
    expect(body.refreshable).toBeUndefined();
  });

  it('devolve o utilizador da sessão com empresa e estado do MFA', async () => {
    signIn('u_ana');
    const body = await session();
    expect(body.user).toMatchObject({
      id: 'u_ana',
      role: 'company_admin',
      companyId: 'co_acme',
      companyName: 'Acme Moçambique',
      mfaEnabled: true,
      mfaRequired: true,
    });
  });

  it('indica que a sessão pode ser renovada quando só o access token expirou', async () => {
    signIn('u_paula');
    getDb().cookies.accessExpiresAt = Date.now() - 1;
    const body = await session();
    expect(body.user).toBeNull();
    expect(body.refreshable).toBe(true);
  });
});

describe('POST /api/auth/refresh', () => {
  it('renova o access token e mantém a mesma sessão', async () => {
    signIn('u_paula');
    const sessionId = getDb().cookies.sessionId;
    getDb().cookies.accessExpiresAt = Date.now() - 1;
    expect((await api('POST', '/api/auth/refresh')).status).toBe(204);
    expect(getDb().cookies.sessionId).toBe(sessionId);
    expect((await session()).user?.id).toBe('u_paula');
  });

  it('responde 401 sem sessão', async () => {
    const response = await api('POST', '/api/auth/refresh');
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe('unauthenticated');
  });
});

describe('POST /api/auth/login', () => {
  it('inicia sessão para um utilizador sem MFA e regista a entrada na auditoria', async () => {
    const response = await login(MOCK_USERS.owner.email, MOCK_USERS.owner.password);
    expect(response.status).toBe(200);
    const body = await readJson<LoginResponse>(response);
    expect(body.status).toBe('authenticated');
    if (body.status === 'authenticated') expect(body.user.id).toBe('u_paula');
    expect(getDb().cookies.sessionId).not.toBeNull();
    expect(recentAuditActions()).toContain('auth.login');
  });

  it('aceita o email com maiúsculas e espaços', async () => {
    const response = await login(`  ${MOCK_USERS.owner.email.toUpperCase()} `, MOCK_USERS.owner.password);
    expect(response.status).toBe(200);
  });

  it('pede o segundo passo a quem tem MFA, sem iniciar sessão', async () => {
    const response = await login(MOCK_USERS.companyAdmin.email, MOCK_USERS.companyAdmin.password);
    expect(await readJson<LoginResponse>(response)).toEqual({ status: 'mfa_required' });
    expect(getDb().cookies.sessionId).toBeNull();
    expect(getDb().cookies.mfaPendingUserId).toBe('u_ana');
  });

  it('dá a mesma resposta genérica a email desconhecido, palavra-passe errada e convite por aceitar', async () => {
    const attempts: Array<[string, string]> = [
      ['ninguem@acme.test', 'Qualquer#2026ok'],
      [MOCK_USERS.owner.email, 'Errada#2026okay'],
      ['convidado@acme.test', 'Qualquer#2026ok'],
    ];
    for (const [email, password] of attempts) {
      const response = await login(email, password);
      expect(response.status).toBe(401);
      expect(await errorCode(response)).toBe('invalid_credentials');
    }
    expect(recentAuditActions()).toContain('auth.login_failed');
  });

  it('limita a 5 tentativas por minuto por email', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(MOCK_USERS.owner.email, 'Errada#2026okay')).status).toBe(401);
    }
    const blocked = await login(MOCK_USERS.owner.email, MOCK_USERS.owner.password);
    expect(blocked.status).toBe(429);
    expect(await errorCode(blocked)).toBe('rate_limited');
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Outro email não é afetado.
    expect((await login(MOCK_USERS.editor.email, MOCK_USERS.editor.password)).status).toBe(200);
  });

  it('recusa corpos com campos a mais', async () => {
    const response = await api('POST', '/api/auth/login', {
      email: MOCK_USERS.owner.email,
      password: MOCK_USERS.owner.password,
      role: 'platform_admin',
    });
    expect(response.status).toBe(422);
  });
});

describe('POST /api/auth/mfa/verify', () => {
  async function startChallenge(): Promise<void> {
    await login(MOCK_USERS.companyAdmin.email, MOCK_USERS.companyAdmin.password);
  }

  it('sem desafio pendente responde 401', async () => {
    const response = await api('POST', '/api/auth/mfa/verify', { code: '123456' });
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe('mfa_challenge_expired');
  });

  it('aceita o código TOTP atual e inicia a sessão', async () => {
    await startChallenge();
    const code = await generateTotp(MOCK_USERS.companyAdmin.totpSecret);
    const response = await api('POST', '/api/auth/mfa/verify', { code });
    expect(response.status).toBe(200);
    expect((await readJson<{ user: SessionUser }>(response)).user.id).toBe('u_ana');
    expect(getDb().cookies.mfaPendingUserId).toBeNull();
    expect((await session()).user?.id).toBe('u_ana');
  });

  it('recusa um código errado e regista a falha', async () => {
    await startChallenge();
    const response = await api('POST', '/api/auth/mfa/verify', { code: '000000' });
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe('invalid_code');
    expect(getDb().cookies.sessionId).toBeNull();
    expect(recentAuditActions()).toContain('auth.login_failed');
  });

  it('aceita um código de recuperação uma única vez', async () => {
    await startChallenge();
    const recoveryCode = MOCK_RECOVERY_CODES.companyAdmin;
    expect((await api('POST', '/api/auth/mfa/verify', { recoveryCode: recoveryCode.toLowerCase() })).status).toBe(200);

    await api('POST', '/api/auth/logout');
    await startChallenge();
    const reused = await api('POST', '/api/auth/mfa/verify', { recoveryCode });
    expect(reused.status).toBe(401);
    expect(await errorCode(reused)).toBe('invalid_code');
  });

  it('limita as tentativas do segundo passo', async () => {
    await startChallenge();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await api('POST', '/api/auth/mfa/verify', { code: '000000' })).status).toBe(401);
    }
    const code = await generateTotp(MOCK_USERS.companyAdmin.totpSecret);
    expect((await api('POST', '/api/auth/mfa/verify', { code })).status).toBe(429);
  });

  it('não aceita código e código de recuperação no mesmo pedido', async () => {
    await startChallenge();
    const response = await api('POST', '/api/auth/mfa/verify', { code: '123456', recoveryCode: 'ABCDE-23456' });
    expect(response.status).toBe(422);
  });
});

describe('POST /api/auth/logout', () => {
  it('termina a sessão atual, muda o token CSRF e regista a saída', async () => {
    signIn('u_ana');
    const before = getDb().csrfToken;
    const sessionId = getDb().cookies.sessionId;
    expect((await api('POST', '/api/auth/logout')).status).toBe(204);
    expect(getDb().cookies.sessionId).toBeNull();
    expect(getDb().csrfToken).not.toBe(before);
    expect(getDb().sessions.some((candidate) => candidate.id === sessionId)).toBe(false);
    // As outras sessões da Ana (outros dispositivos) continuam.
    expect(getDb().sessions.some((candidate) => candidate.userId === 'u_ana')).toBe(true);
    expect(recentAuditActions()).toContain('auth.logout');
  });

  it('responde 204 mesmo sem sessão', async () => {
    expect((await api('POST', '/api/auth/logout')).status).toBe(204);
  });
});

describe('configuração de MFA', () => {
  async function enableMfa(): Promise<string[]> {
    const setup = await api('POST', '/api/auth/mfa/setup');
    const { secret } = await readJson<{ secret: string }>(setup);
    const confirm = await api('POST', '/api/auth/mfa/confirm', { code: await generateTotp(secret) });
    expect(confirm.status).toBe(200);
    return (await readJson<{ recoveryCodes: string[] }>(confirm)).recoveryCodes;
  }

  it('exige sessão', async () => {
    expect((await api('POST', '/api/auth/mfa/setup')).status).toBe(401);
  });

  it('gera a chave, confirma com um código e devolve códigos de recuperação uma única vez', async () => {
    signIn('u_nelson');
    const setup = await api('POST', '/api/auth/mfa/setup');
    expect(setup.status).toBe(200);
    const body = await readJson<{ secret: string; otpauthUrl: string }>(setup);
    expect(body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.otpauthUrl).toBe(
      `otpauth://totp/NFC%20Business:${encodeURIComponent(MOCK_USERS.newAdmin.email)}?secret=${body.secret}&issuer=NFC%20Business&algorithm=SHA1&digits=6&period=30`,
    );
    expect((await session()).user?.mfaEnabled).toBe(false);

    const wrong = await api('POST', '/api/auth/mfa/confirm', { code: '000000' });
    expect(wrong.status).toBe(422);
    expect(await errorCode(wrong)).toBe('invalid_code');

    const confirm = await api('POST', '/api/auth/mfa/confirm', { code: await generateTotp(body.secret) });
    const { recoveryCodes } = await readJson<{ recoveryCodes: string[] }>(confirm);
    expect(recoveryCodes).toHaveLength(8);
    for (const code of recoveryCodes) expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    expect((await session()).user?.mfaEnabled).toBe(true);
    expect(recentAuditActions()).toContain('auth.mfa_enabled');

    const again = await api('POST', '/api/auth/mfa/setup');
    expect(again.status).toBe(409);
    expect(await errorCode(again)).toBe('mfa_already_enabled');
  });

  it('não confirma sem ter começado a configuração', async () => {
    signIn('u_paula');
    const response = await api('POST', '/api/auth/mfa/confirm', { code: '123456' });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe('mfa_not_pending');
  });

  it('não deixa administradores desativar o MFA', async () => {
    signIn('u_ana');
    const response = await api('POST', '/api/auth/mfa/disable', { password: MOCK_USERS.companyAdmin.password });
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('mfa_required_for_role');
    expect((await session()).user?.mfaEnabled).toBe(true);
  });

  it('desativa o MFA de um utilizador comum com a palavra-passe atual', async () => {
    signIn('u_paula');
    const notEnabled = await api('POST', '/api/auth/mfa/disable', { password: MOCK_USERS.owner.password });
    expect(notEnabled.status).toBe(409);
    expect(await errorCode(notEnabled)).toBe('mfa_not_enabled');

    await enableMfa();
    const wrongPassword = await api('POST', '/api/auth/mfa/disable', { password: 'Errada#2026okay' });
    expect(wrongPassword.status).toBe(422);
    expect(await errorCode(wrongPassword)).toBe('invalid_current_password');

    expect((await api('POST', '/api/auth/mfa/disable', { password: MOCK_USERS.owner.password })).status).toBe(204);
    expect((await session()).user?.mfaEnabled).toBe(false);
  });
});

describe('recuperação de palavra-passe', () => {
  it('responde sempre 202, exista ou não a conta, e cria o link só para contas existentes', async () => {
    const before = Object.keys(getDb().resetTokens).length;
    expect((await api('POST', '/api/auth/recover', { email: 'ninguem@acme.test' })).status).toBe(202);
    expect(Object.keys(getDb().resetTokens)).toHaveLength(before);
    expect((await api('POST', '/api/auth/recover', { email: MOCK_USERS.owner.email })).status).toBe(202);
    const tokens = Object.entries(getDb().resetTokens);
    expect(tokens).toHaveLength(before + 1);
    const created = tokens.find(([token]) => token !== MOCK_TOKENS.reset);
    expect(created?.[1].userId).toBe('u_paula');
    expect(Date.parse(created?.[1].expiresAt ?? '')).toBeLessThanOrEqual(Date.now() + 3_600_000);
  });

  it('limita os pedidos de recuperação por email', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await api('POST', '/api/auth/recover', { email: 'ninguem@acme.test' })).status).toBe(202);
    }
    expect((await api('POST', '/api/auth/recover', { email: 'ninguem@acme.test' })).status).toBe(429);
  });

  it('define a nova palavra-passe, consome o link e termina todas as sessões', async () => {
    signIn('u_paula');
    const weak = await api('POST', '/api/auth/recover/confirm', { token: MOCK_TOKENS.reset, password: 'password1234' });
    expect(weak.status).toBe(422);
    expect(await errorCode(weak)).toBe('weak_password');

    const ok = await api('POST', '/api/auth/recover/confirm', { token: MOCK_TOKENS.reset, password: STRONG_PASSWORD });
    expect(ok.status).toBe(204);
    expect(getDb().sessions.some((candidate) => candidate.userId === 'u_paula')).toBe(false);
    expect(getDb().cookies.sessionId).toBeNull();
    expect(recentAuditActions()).toContain('auth.password_changed');

    const reused = await api('POST', '/api/auth/recover/confirm', { token: MOCK_TOKENS.reset, password: STRONG_PASSWORD });
    expect(reused.status).toBe(400);
    expect(await errorCode(reused)).toBe('invalid_token');

    expect((await login(MOCK_USERS.owner.email, STRONG_PASSWORD)).status).toBe(200);
  });

  it('recusa links desconhecidos ou expirados', async () => {
    const unknown = await api('POST', '/api/auth/recover/confirm', {
      token: 'token-desconhecido-0001',
      password: STRONG_PASSWORD,
    });
    expect(unknown.status).toBe(400);
    expect(await errorCode(unknown)).toBe('invalid_token');

    getDb().resetTokens['token-expirado-000001'] = { userId: 'u_paula', expiresAt: new Date(Date.now() - 1).toISOString() };
    const expired = await api('POST', '/api/auth/recover/confirm', { token: 'token-expirado-000001', password: STRONG_PASSWORD });
    expect(expired.status).toBe(400);
    expect(getDb().resetTokens['token-expirado-000001']).toBeUndefined();
  });
});

describe('POST /api/auth/invite/accept', () => {
  it('ativa a conta convidada sem iniciar sessão e consome o convite', async () => {
    const weak = await api('POST', '/api/auth/invite/accept', {
      token: MOCK_TOKENS.invite,
      name: 'Novo Membro',
      password: '123456789012',
    });
    expect(weak.status).toBe(422);

    const ok = await api('POST', '/api/auth/invite/accept', {
      token: MOCK_TOKENS.invite,
      name: 'Novo Membro',
      password: STRONG_PASSWORD,
    });
    expect(ok.status).toBe(204);
    expect(getDb().cookies.sessionId).toBeNull();
    const user = getDb().users.find((candidate) => candidate.id === 'u_convidado');
    expect(user).toMatchObject({ name: 'Novo Membro', status: 'active' });
    expect(getDb().inviteTokens[MOCK_TOKENS.invite]).toBeUndefined();

    expect((await login('convidado@acme.test', STRONG_PASSWORD)).status).toBe(200);
  });

  it('recusa convites desconhecidos', async () => {
    const response = await api('POST', '/api/auth/invite/accept', {
      token: 'convite-desconhecido-01',
      name: 'Alguém',
      password: STRONG_PASSWORD,
    });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('invalid_token');
  });
});

describe('conta', () => {
  it('atualiza o nome e devolve a sessão', async () => {
    signIn('u_paula');
    const response = await api('PATCH', '/api/auth/account', { name: 'Paula M. Machava' });
    expect(response.status).toBe(200);
    expect((await readJson<SessionUser>(response)).name).toBe('Paula M. Machava');
    expect((await session()).user?.name).toBe('Paula M. Machava');
  });

  it('exige sessão e, para administradores, MFA configurado', async () => {
    expect((await api('PATCH', '/api/auth/account', { name: 'Alguém' })).status).toBe(401);
    signIn('u_nelson');
    const response = await api('PATCH', '/api/auth/account', { name: 'Nelson T.' });
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('mfa_setup_required');
  });

  it('muda a palavra-passe com a atual', async () => {
    signIn('u_paula');
    const wrong = await api('POST', '/api/auth/password', {
      currentPassword: 'Errada#2026okay',
      newPassword: STRONG_PASSWORD,
    });
    expect(wrong.status).toBe(422);
    expect(await errorCode(wrong)).toBe('invalid_current_password');

    const weak = await api('POST', '/api/auth/password', {
      currentPassword: MOCK_USERS.owner.password,
      newPassword: 'qwertyuiop12',
    });
    expect(await errorCode(weak)).toBe('weak_password');

    const ok = await api('POST', '/api/auth/password', {
      currentPassword: MOCK_USERS.owner.password,
      newPassword: STRONG_PASSWORD,
    });
    expect(ok.status).toBe(204);
    expect(recentAuditActions()).toContain('auth.password_changed');
    await api('POST', '/api/auth/logout');
    expect((await login(MOCK_USERS.owner.email, STRONG_PASSWORD)).status).toBe(200);
  });

  it('lista as sessões com a atual assinalada e termina todas', async () => {
    signIn('u_ana');
    const list = await api('GET', '/api/auth/sessions');
    expect(list.status).toBe(200);
    const { items } = await readJson<AuthSessionList>(list);
    expect(items).toHaveLength(3);
    expect(items.filter((item) => item.current)).toHaveLength(1);
    expect(items[0]?.current).toBe(true);
    expect(items.map((item) => item.device)).toContain('Safari em iPhone');

    expect((await api('DELETE', '/api/auth/sessions')).status).toBe(204);
    expect(getDb().sessions.some((candidate) => candidate.userId === 'u_ana')).toBe(false);
    expect(getDb().audit[0]?.action).toBe('auth.sessions_revoked');
    expect((await api('GET', '/api/auth/sessions')).status).toBe(401);
  });
});
