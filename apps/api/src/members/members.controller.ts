import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  memberInviteRequestSchema,
  memberUpdateRequestSchema,
  type Member,
  type MemberInviteRequest,
  type MemberList,
  type MemberUpdateRequest,
} from '@nfc-business/shared/schemas';
import { AuditService } from '../audit/audit.service';
import { auditActorOf, dbContextOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService } from '../database/database.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { MEMBER_SELECT, MembersService, toMember, type MemberRow } from './members.service';

function requireCompany(user: SessionUser): string {
  if (!user.companyId) throw new ForbiddenException({ error: { code: 'forbidden' } });
  return user.companyId;
}

/**
 * Membros da empresa da sessão (company_admin, `members.manage`). O próprio não muda o seu papel nem se remove,
 * para nunca ficar uma empresa sem administrador.
 */
@Controller('members')
export class MembersController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MembersService) private readonly members: MembersService,
    @Inject(SupabaseAdminService) private readonly admin: SupabaseAdminService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Req() req: AuthedRequest): Promise<MemberList> {
    const user = requirePermission(req, 'members.manage');
    const companyId = requireCompany(user);
    const rows = await this.database.withContext(dbContextOf(user), async (db) => {
      const result = await db.query<MemberRow>(`${MEMBER_SELECT} where company_id = $1 order by created_at, email`, [
        companyId,
      ]);
      return result.rows;
    });
    return { items: rows.map(toMember) };
  }

  @Post()
  async invite(
    @Body(new ZodValidationPipe(memberInviteRequestSchema)) body: MemberInviteRequest,
    @Req() req: AuthedRequest,
  ): Promise<Member> {
    const user = requirePermission(req, 'members.manage');
    const companyId = requireCompany(user);
    const member = await this.database.withContext(dbContextOf(user), (db) =>
      this.members.invite(db, body.email, body.role, companyId),
    );
    await this.audit.record({ action: 'member.invited', actor: auditActorOf(user), target: member.email });
    return member;
  }

  @Patch(':id')
  async changeRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(memberUpdateRequestSchema)) body: MemberUpdateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Member> {
    const user = requirePermission(req, 'members.manage');
    const companyId = requireCompany(user);
    const member = await this.database.withContext(dbContextOf(user), async (db) => {
      const current = await this.members.memberOr404(db, companyId, id);
      if (current.id === user.id) throw new ConflictException({ error: { code: 'cannot_change_self' } });
      // Primeiro no Supabase (é o que vale na sessão); depois o espelho, na mesma transação.
      await this.admin.setRole(current.id, body.role, companyId);
      const updated = await db.query<MemberRow>(
        `update app.users set role = $3 where id::text = $1 and company_id = $2
         returning id::text as id, name, email, role, status, created_at`,
        [id, companyId, body.role],
      );
      return toMember(updated.rows[0]!);
    });
    await this.audit.record({ action: 'member.role_changed', actor: auditActorOf(user), target: member.email });
    return member;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest): Promise<void> {
    const user = requirePermission(req, 'members.manage');
    const companyId = requireCompany(user);
    const email = await this.database.withContext(dbContextOf(user), async (db) => {
      const current = await this.members.memberOr404(db, companyId, id);
      if (current.id === user.id) throw new ConflictException({ error: { code: 'cannot_change_self' } });
      // Os perfis do membro ficam sem dono (on delete set null) e as sessões terminam com a conta.
      await this.admin.deleteUser(current.id);
      return current.email;
    });
    await this.audit.record({ action: 'member.removed', actor: auditActorOf(user), target: email });
  }
}
