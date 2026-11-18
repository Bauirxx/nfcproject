import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { memberSchema } from '@nfc-business/shared/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import type { DatabaseService, Queryable } from '../database/database.service';
import type { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { MembersController } from './members.controller';
import { MembersService, type MemberRow } from './members.service';

const admin: SessionUser = {
  id: 'admin-1',
  name: 'Ana',
  email: 'ana@acme.test',
  role: 'company_admin',
  companyId: 'co_a',
  companyName: 'ACME',
  mfaEnabled: true,
  mfaRequired: true,
};
const req = (user: SessionUser = admin) => ({ user }) as unknown as AuthedRequest;
const row = (overrides: Partial<MemberRow> = {}): MemberRow => ({
  id: 'u-2',
  name: null,
  email: 'novo@acme.test',
  role: 'company_editor',
  status: 'invited',
  created_at: new Date('2026-11-18T10:00:00Z'),
  ...overrides,
});

function setup(options: { inviteResult?: Awaited<ReturnType<SupabaseAdminService['invite']>>; rows?: MemberRow[]; failInsert?: boolean } = {}) {
  const adminService = {
    invite: vi.fn(async () => options.inviteResult ?? { status: 'invited', userId: 'u-2' }),
    setRole: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
  } as unknown as SupabaseAdminService;
  const query = vi.fn(async (text: string) => {
    if (options.failInsert && text.startsWith('insert')) throw new Error('falha');
    if (text.startsWith('insert') || text.startsWith('update')) return { rows: [row({ role: 'company_admin' })] };
    return { rows: options.rows ?? [] };
  });
  const db = { query } as unknown as Queryable;
  const database = { withContext: vi.fn(async (_ctx: unknown, work: (q: Queryable) => Promise<unknown>) => work(db)) } as unknown as DatabaseService;
  const members = new MembersService(adminService, loadEnv({ PUBLIC_APP_URL: 'https://app.exemplo.com' }));
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  return { controller: new MembersController(database, members, adminService, audit), adminService, audit, query };
}

describe('MembersController', () => {
  it('convida com o link para /convite, espelha em app.users e audita', async () => {
    const { controller, adminService, audit, query } = setup();
    const member = await controller.invite({ email: 'Novo@ACME.test', role: 'company_editor' }, req());
    expect(memberSchema.safeParse(member).success).toBe(true);
    expect(adminService.invite).toHaveBeenCalledWith('novo@acme.test', 'company_editor', 'co_a', 'https://app.exemplo.com/convite');
    expect(query.mock.calls[0]?.[0]).toContain('insert into app.users');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'member.invited' }));
  });

  it('email já registado: 409 already_member', async () => {
    const { controller } = setup({ inviteResult: { status: 'already_exists' } });
    await expect(controller.invite({ email: 'x@acme.test', role: 'profile_owner' }, req())).rejects.toMatchObject({
      response: { error: { code: 'already_member' } },
    });
  });

  it('se o espelho falhar, a conta criada é removida (não fica órfã)', async () => {
    const { controller, adminService } = setup({ failInsert: true });
    await expect(controller.invite({ email: 'x@acme.test', role: 'profile_owner' }, req())).rejects.toThrow('falha');
    expect(adminService.deleteUser).toHaveBeenCalledWith('u-2');
  });

  it('o próprio não muda o papel nem se remove; membro de outra empresa dá 404', async () => {
    const self = setup({ rows: [row({ id: 'admin-1', role: 'company_admin' })] });
    await expect(self.controller.changeRole('admin-1', { role: 'profile_owner' }, req())).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(self.controller.remove('admin-1', req())).rejects.toBeInstanceOf(ConflictException);

    const missing = setup({ rows: [] });
    await expect(missing.controller.remove('u-de-outra-empresa', req())).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.adminService.deleteUser).not.toHaveBeenCalled();
  });

  it('muda o papel no Supabase e no espelho; remove a conta', async () => {
    const { controller, adminService, audit } = setup({ rows: [row()] });
    const updated = await controller.changeRole('u-2', { role: 'company_admin' }, req());
    expect(adminService.setRole).toHaveBeenCalledWith('u-2', 'company_admin', 'co_a');
    expect(updated.role).toBe('company_admin');
    await controller.remove('u-2', req());
    expect(adminService.deleteUser).toHaveBeenCalledWith('u-2');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'member.removed' }));
  });

  it('só quem gere membros e tem empresa', async () => {
    const { controller } = setup();
    const editor = { ...admin, role: 'company_editor' as const };
    await expect(controller.list(req(editor))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
