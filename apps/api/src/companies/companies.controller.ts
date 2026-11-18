import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  companyCreateRequestSchema,
  companyUpdateRequestSchema,
  type Company,
  type CompanyCreateRequest,
  type CompanyList,
  type CompanyUpdateRequest,
} from '@nfc-business/shared/schemas';
import { isHexColor } from '@nfc-business/shared/validators';
import { AuditService } from '../audit/audit.service';
import { auditActorOf, dbContextOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService, type Queryable } from '../database/database.service';
import { MembersService } from '../members/members.service';

/** Marca usada quando a empresa ainda não tem uma guardada (mesma da API simulada). */
export const DEFAULT_BRAND = { primaryColor: '#1e40af', accentColor: '#0f766e' } as const;

interface CompanyRow {
  id: string;
  name: string;
  contact_email: string;
  logo_url: string | null;
  brand: unknown;
  created_at: Date;
  cards_count: number;
  members_count: number;
}

const SELECT = `select c.id, c.name, c.contact_email, c.logo_url, c.brand, c.created_at,
  (select count(*)::int from app.cards k where k.company_id = c.id) as cards_count,
  (select count(*)::int from app.users u where u.company_id = c.id) as members_count
  from app.companies c`;

export function toCompany(row: CompanyRow): Company {
  const brand = typeof row.brand === 'object' && row.brand !== null ? (row.brand as Record<string, unknown>) : {};
  const color = (value: unknown, fallback: string) => (typeof value === 'string' && isHexColor(value) ? value : fallback);
  return {
    id: row.id,
    name: row.name,
    contactEmail: row.contact_email,
    logoUrl: row.logo_url,
    brand: {
      primaryColor: color(brand.primaryColor, DEFAULT_BRAND.primaryColor),
      accentColor: color(brand.accentColor, DEFAULT_BRAND.accentColor),
    },
    cardsCount: row.cards_count,
    membersCount: row.members_count,
    createdAt: row.created_at.toISOString(),
  };
}

/** Empresas: só platform_admin (`companies.manage`). Leitura e escrita protegidas também pela RLS. */
@Controller('companies')
export class CompaniesController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MembersService) private readonly members: MembersService,
  ) {}

  @Get()
  async list(@Req() req: AuthedRequest): Promise<CompanyList> {
    const user = requirePermission(req, 'companies.manage');
    const rows = await this.database.withContext(dbContextOf(user), async (db) => {
      const result = await db.query<CompanyRow>(`${SELECT} order by c.name`);
      return result.rows;
    });
    return { items: rows.map(toCompany) };
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Company> {
    const user = requirePermission(req, 'companies.manage');
    return this.database.withContext(dbContextOf(user), (db) => this.findOr404(db, id));
  }

  /**
   * Cria a empresa e convida o primeiro administrador (P-09: o registo é só por convite). Tudo na mesma
   * transação: se o convite falhar, a empresa não fica criada (ADR-0017).
   */
  @Post()
  async create(
    @Body(new ZodValidationPipe(companyCreateRequestSchema)) body: CompanyCreateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Company> {
    const user = requirePermission(req, 'companies.manage');
    if (body.logoFileId) throw new UnprocessableEntityException({ error: { code: 'invalid_file' } });
    const company = await this.database.withContext(dbContextOf(user), async (db) => {
      const inserted = await db.query<{ id: string }>(
        `insert into app.companies (name, contact_email, brand) values ($1, $2, $3::jsonb) returning id`,
        [body.name, body.contactEmail, JSON.stringify(body.brand)],
      );
      const id = inserted.rows[0]!.id;
      await this.members.invite(db, body.adminEmail, 'company_admin', id);
      return this.findOr404(db, id);
    });
    await this.audit.record({ action: 'company.created', actor: { ...auditActorOf(user), companyId: company.id }, target: company.name });
    await this.audit.record({
      action: 'member.invited',
      actor: { ...auditActorOf(user), companyId: company.id },
      target: body.adminEmail,
    });
    return company;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(companyUpdateRequestSchema)) body: CompanyUpdateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Company> {
    const user = requirePermission(req, 'companies.manage');
    // Os uploads (logótipo) ainda não existem no backend: só se aceita remover o logótipo.
    if (body.logoFileId) throw new UnprocessableEntityException({ error: { code: 'invalid_file' } });
    const company = await this.database.withContext(dbContextOf(user), async (db) => {
      await this.findOr404(db, id);
      await db.query(
        `update app.companies
            set name = coalesce($2, name),
                contact_email = coalesce($3, contact_email),
                brand = coalesce($4::jsonb, brand),
                logo_url = case when $5 then null else logo_url end
          where id = $1`,
        [id, body.name ?? null, body.contactEmail ?? null, body.brand ? JSON.stringify(body.brand) : null, body.logoFileId === null],
      );
      return this.findOr404(db, id);
    });
    await this.audit.record({
      action: 'company.updated',
      actor: { ...auditActorOf(user), companyId: company.id },
      target: company.name,
    });
    return company;
  }

  private async findOr404(db: Queryable, id: string): Promise<Company> {
    const result = await db.query<CompanyRow>(`${SELECT} where c.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: { code: 'not_found' } });
    return toCompany(row);
  }
}
