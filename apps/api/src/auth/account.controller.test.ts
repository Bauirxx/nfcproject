import { createHash } from 'node:crypto';
import { UnprocessableEntityException } from '@nestjs/common';
import { authSessionListSchema } from '@nfc-business/shared/schemas';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { AuthedRequest } from '../common/auth.guard';
import { isBreachedPassword, type Fetcher } from '../common/breached-password';
import type { SessionService } from '../common/session.service';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import type { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { AccountController, describeDevice } from './account.controller';

const breached = vi.hoisted(() => ({ value: false }));
vi.mock('../common/breached-password', async (importOriginal) => {
  const original = await importOriginal<typeof import('../common/breached-password')>();
  return { ...original, isBreachedPassword: vi.fn(async () => breached.value) };
});

describe('isBreachedPassword (k-anonimato)', () => {
  const sha1 = (value: string) => createHash('sha1').update(value).digest('hex').toUpperCase();

  it('só envia os 5 primeiros caracteres do hash e encontra o sufixo na resposta', async () => {
    const { isBreachedPassword: real } = await vi.importActual<typeof import('../common/breached-password')>(
      '../common/breached-password',
    );
    const hash = sha1('Password#2026');
    const fetcher = vi.fn<Fetcher>(async () => ({ ok: true, text: async () => `AAAA:1\r\n${hash.slice(5)}:42\r\nBBBB:0` }));
    expect(await real('Password#2026', fetcher)).toBe(true);
    const url = String(fetcher.mock.calls[0]?.[0]);
    expect(url.endsWith(`/range/${hash.slice(0, 5)}`)).toBe(true);
    expect(url).not.toContain(hash.slice(5));
    expect(url).not.toContain('Password');

    // Entrada de preenchimento (contagem 0) não conta; serviço em baixo deixa passar.
    const padded = vi.fn<Fetcher>(async () => ({ ok: true, text: async () => `${hash.slice(5)}:0` }));
    expect(await real('Password#2026', padded)).toBe(false);
    const down = vi.fn<Fetcher>(async () => {
      throw new Error('timeout');
    });
    expect(await real('Password#2026', down)).toBe(false);
  });
});

describe('describeDevice', () => {
  it('resume o navegador e o sistema', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36')).toBe(
      'Chrome em Android',
    );
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0')).toBe(
      'Edge em Windows',
    );
    expect(describeDevice(undefined)).toBe('Navegador em dispositivo desconhecido');
  });
});

describe('AccountController', () => {
  const user: SessionUser = {
    id: 'u1',
    name: 'Paula',
    email: 'paula@exemplo.test',
    role: 'profile_owner',
    companyId: 'co_a',
    companyName: 'ACME',
    mfaEnabled: false,
    mfaRequired: false,
  };
  const req = { user, headers: { cookie: 'nfc_access=a.b.c; nfc_refresh=r1', 'user-agent': 'Firefox/130.0 (X11; Linux)' } } as unknown as AuthedRequest;
  const res = () => ({ setHeader: vi.fn(), clearCookie: vi.fn() }) as unknown as Response;

  function setup(checkPassword = true) {
    const supabase = {
      checkPassword: vi.fn(async () => checkPassword),
      updatePassword: vi.fn(async () => true),
      revokeAll: vi.fn(async () => true),
    } as unknown as SupabaseAuthService;
    const sessions = { accessToken: () => 'a.b.c' } as unknown as SessionService;
    const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
    return { controller: new AccountController(supabase, sessions, audit, loadEnv({})), supabase, audit };
  }

  beforeEach(() => {
    breached.value = false;
  });

  it('muda a palavra-passe depois de confirmar a atual e regista na auditoria', async () => {
    const { controller, supabase, audit } = setup();
    await controller.changePassword({ currentPassword: 'Atual#2026xx', newPassword: 'NovaSegura#2026' }, req, res());
    expect(supabase.updatePassword).toHaveBeenCalledWith({ accessToken: 'a.b.c', refreshToken: 'r1' }, 'NovaSegura#2026');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password_changed' }));
    expect(JSON.stringify((audit.record as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('NovaSegura');
  });

  it('recusa com a palavra-passe atual errada ou com uma nova vazada', async () => {
    await expect(
      setup(false).controller.changePassword({ currentPassword: 'x', newPassword: 'NovaSegura#2026' }, req, res()),
    ).rejects.toMatchObject({ response: { error: { code: 'invalid_current_password' } } });

    breached.value = true;
    const { controller, supabase } = setup();
    await expect(
      controller.changePassword({ currentPassword: 'Atual#2026xx', newPassword: 'password123456' }, req, res()),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(supabase.updatePassword).not.toHaveBeenCalled();
    expect(isBreachedPassword).toHaveBeenCalled();
  });

  it('lista a sessão atual no contrato e termina todas, apagando os cookies', async () => {
    const { controller, supabase, audit } = setup();
    const list = controller.listSessions(req);
    expect(authSessionListSchema.safeParse(list).success).toBe(true);
    expect(list.items[0]).toMatchObject({ current: true, device: 'Firefox em Linux' });

    const response = res();
    await controller.revokeSessions(req, response);
    expect(supabase.revokeAll).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.sessions_revoked' }));
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});
