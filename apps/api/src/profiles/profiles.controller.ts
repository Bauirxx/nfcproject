import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DEFAULT_THEME } from '@nfc-business/shared/constants';
import { can } from '@nfc-business/shared/permissions';
import {
  profileCreateRequestSchema,
  profileListQuerySchema,
  profileUpdateRequestSchema,
  type Profile,
  type ProfileCreateRequest,
  type ProfilePage,
  type ProfileUpdateRequest,
} from '@nfc-business/shared/schemas';
import { isHexColor, isSlug } from '@nfc-business/shared/validators';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { likePattern } from '../audit/audit.controller';
import { auditActorOf, dbContextOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService, type Queryable } from '../database/database.service';

type ProfileListQuery = z.output<typeof profileListQuerySchema>;

interface ProfileRow {
  id: string;
  slug: string;
  owner_user_id: string | null;
  owner_name: string | null;
  display_name: string;
  title: string | null;
  company_name: string | null;
  bio: string | null;
  photo_url: string | null;
  visibility: Profile['visibility'];
  contacts: Profile['contacts'];
  social_links: Profile['socialLinks'];
  theme: unknown;
  active_card_token: string | null;
  cards_count: number;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `select p.id, p.slug, p.owner_user_id, coalesce(u.name, u.email) as owner_name, p.display_name, p.title,
  p.company_name, p.bio, p.photo_url, p.visibility, p.contacts, p.social_links, p.theme,
  (select k.token from app.cards k where k.profile_id = p.id and k.status = 'active' order by k.updated_at desc limit 1)
    as active_card_token,
  (select count(*)::int from app.cards k where k.profile_id = p.id) as cards_count,
  p.created_at, p.updated_at
  from app.profiles p left join app.users u on u.id = p.owner_user_id`;

/** Tema guardado completado com o tema por defeito (cores inválidas voltam ao valor por defeito). */
export function themeOf(stored: unknown): Profile['theme'] {
  const theme = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const color = (key: 'primaryColor' | 'backgroundColor' | 'textColor') =>
    typeof theme[key] === 'string' && isHexColor(theme[key]) ? theme[key] : DEFAULT_THEME[key];
  const template = theme.template === 'modern' || theme.template === 'minimal' ? theme.template : 'classic';
  return {
    template,
    primaryColor: color('primaryColor'),
    backgroundColor: color('backgroundColor'),
    textColor: color('textColor'),
    logoUrl: typeof theme.logoUrl === 'string' ? theme.logoUrl : null,
  };
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    slug: row.slug,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    displayName: row.display_name,
    title: row.title,
    company: row.company_name,
    bio: row.bio,
    photoUrl: row.photo_url,
    visibility: row.visibility,
    contacts: row.contacts,
    socialLinks: row.social_links,
    theme: themeOf(row.theme),
    activeCardToken: row.active_card_token,
    cardsCount: row.cards_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Base do endereço amigável: minúsculas, sem acentos, só letras, dígitos e hífens (como a API simulada). */
export function slugBase(displayName: string): string {
  let base = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (base.length < 3) base = base === '' ? 'perfil' : `perfil-${base}`;
  return isSlug(base) ? base : 'perfil';
}

const emptyToNull = (value: string | null | undefined) => (value === '' ? null : value);
const notFound = () => new NotFoundException({ error: { code: 'not_found' } });
const forbidden = () => new ForbiddenException({ error: { code: 'forbidden' } });

function requireCompany(user: SessionUser): string {
  if (!user.companyId) throw forbidden();
  return user.companyId;
}

/** Só o dono vê os seus perfis (P-04); administradores e editores vêem os da empresa. */
function ownerFilter(user: SessionUser): string | null {
  return user.role === 'profile_owner' ? user.id : null;
}

/** Perfis digitais (P-02 a P-05 e P-10). Posse por `id` e `company_id` da sessão, além da RLS. */
@Controller('profiles')
export class ProfilesController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(profileListQuerySchema)) query: ProfileListQuery,
    @Req() req: AuthedRequest,
  ): Promise<ProfilePage> {
    const user = requirePermission(req, 'profiles.view');
    const companyId = requireCompany(user);
    const offset = (query.page - 1) * query.pageSize;
    return this.database.withContext(dbContextOf(user), async (db) => {
      const where = `where p.company_id = $1 and ($2::uuid is null or p.owner_user_id = $2)
        and ($3::text is null or p.display_name ilike $3 or p.title ilike $3 or p.company_name ilike $3)`;
      const params = [companyId, ownerFilter(user), query.search ? likePattern(query.search) : null];
      const total = await db.query<{ n: number }>(`select count(*)::int as n from app.profiles p ${where}`, params);
      const rows = await db.query<ProfileRow>(`${SELECT} ${where} order by p.display_name, p.id limit $4 offset $5`, [
        ...params,
        query.pageSize,
        offset,
      ]);
      return { items: rows.rows.map(toProfile), page: query.page, pageSize: query.pageSize, total: total.rows[0]?.n ?? 0 };
    });
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(profileCreateRequestSchema)) body: ProfileCreateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Profile> {
    const user = requirePermission(req, 'profiles.create');
    const companyId = requireCompany(user);
    // Só o company_admin atribui o dono (P-10).
    if (body.ownerUserId !== undefined && !can(user.role, 'profiles.assignOwner')) throw forbidden();
    const profile = await this.database.withContext(dbContextOf(user), async (db) => {
      const ownerId = body.ownerUserId ? await this.companyUserOr404(db, companyId, body.ownerUserId) : null;
      const company = await db.query<{ name: string }>('select name from app.companies where id = $1', [companyId]);
      const id = await this.insertWithUniqueSlug(db, slugBase(body.displayName), [
        companyId,
        ownerId,
        body.displayName,
        company.rows[0]?.name ?? null,
        JSON.stringify(DEFAULT_THEME),
      ]);
      return this.findOr404(db, user, id);
    });
    await this.audit.record({ action: 'profile.created', actor: auditActorOf(user), target: profile.displayName });
    return profile;
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Profile> {
    const user = requirePermission(req, 'profiles.view');
    return this.database.withContext(dbContextOf(user), (db) => this.findOr404(db, user, id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(profileUpdateRequestSchema)) body: ProfileUpdateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Profile> {
    const user = requirePermission(req, 'profiles.edit');
    // Autorizações antes de qualquer alteração: dono só pelo company_admin (P-10), tema só por quem gere temas (P-03).
    if (body.ownerUserId !== undefined && !can(user.role, 'profiles.assignOwner')) throw forbidden();
    if (body.theme !== undefined && !can(user.role, 'themes.manage')) throw forbidden();
    // Os uploads (fotografia e logótipo) ainda não existem no backend: só se aceita remover.
    if (body.photoFileId || body.theme?.logoFileId) throw new UnprocessableEntityException({ error: { code: 'invalid_file' } });

    const profile = await this.database.withContext(dbContextOf(user), async (db) => {
      const current = await this.findOr404(db, user, id, true);
      const companyId = requireCompany(user);
      const ownerId =
        body.ownerUserId === undefined
          ? current.ownerUserId
          : body.ownerUserId === null
            ? null
            : await this.companyUserOr404(db, companyId, body.ownerUserId);
      let theme = current.theme;
      if (body.theme !== undefined) {
        const { logoFileId, ...colors } = body.theme;
        theme = { ...colors, logoUrl: logoFileId === null ? null : current.theme.logoUrl };
      }
      await db.query(
        `update app.profiles set
            owner_user_id = $3, display_name = $4, title = $5, company_name = $6, bio = $7,
            photo_url = $8, visibility = $9::jsonb, contacts = $10::jsonb, social_links = $11::jsonb,
            theme = $12::jsonb, updated_at = now()
          where id = $1 and company_id = $2`,
        [
          id,
          companyId,
          ownerId,
          body.displayName ?? current.displayName,
          body.title === undefined ? current.title : emptyToNull(body.title),
          body.company === undefined ? current.company : emptyToNull(body.company),
          body.bio === undefined ? current.bio : emptyToNull(body.bio),
          body.photoFileId === null ? null : current.photoUrl,
          JSON.stringify(body.visibility ?? current.visibility),
          JSON.stringify(body.contacts ?? current.contacts),
          JSON.stringify(body.socialLinks ?? current.socialLinks),
          JSON.stringify(theme),
        ],
      );
      return this.findOr404(db, user, id);
    });
    await this.audit.record({ action: 'profile.updated', actor: auditActorOf(user), target: profile.displayName });
    return profile;
  }

  /**
   * Insere com um endereço amigável único em todas as empresas. A RLS só deixa ver a própria empresa, por isso
   * a unicidade fica a cargo da base de dados: em conflito tenta o sufixo seguinte (com savepoint).
   */
  private async insertWithUniqueSlug(db: Queryable, base: string, values: unknown[]): Promise<string> {
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const slug = attempt === 1 ? base : `${base}-${attempt}`;
      await db.query('savepoint slug_attempt');
      try {
        const result = await db.query<{ id: string }>(
          `insert into app.profiles (company_id, owner_user_id, display_name, company_name, theme, slug)
           values ($1, $2, $3, $4, $5::jsonb, $6) returning id`,
          [...values, slug],
        );
        await db.query('release savepoint slug_attempt');
        return result.rows[0]!.id;
      } catch (error) {
        await db.query('rollback to savepoint slug_attempt');
        const pgError = error as { code?: string; constraint?: string };
        if (pgError.code !== '23505' || !String(pgError.constraint).includes('slug')) throw error;
      }
    }
    throw new UnprocessableEntityException({ error: { code: 'slug_unavailable' } });
  }

  private async findOr404(db: Queryable, user: SessionUser, id: string, lock = false): Promise<Profile> {
    const result = await db.query<ProfileRow>(
      `${SELECT} where p.id = $1 and p.company_id = $2 and ($3::uuid is null or p.owner_user_id = $3)${lock ? ' for update of p' : ''}`,
      [id, requireCompany(user), ownerFilter(user)],
    );
    const row = result.rows[0];
    if (!row) throw notFound();
    return toProfile(row);
  }

  /** Utilizador da mesma empresa (dono do perfil); senão é como se não existisse. */
  private async companyUserOr404(db: Queryable, companyId: string, userId: string): Promise<string> {
    const result = await db.query<{ id: string }>(
      `select id from app.users where id::text = $1 and company_id = $2`,
      [userId, companyId],
    );
    if (!result.rows[0]) throw notFound();
    return result.rows[0].id;
  }
}
