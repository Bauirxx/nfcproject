import { randomBytes } from 'node:crypto';
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  CARD_TRANSITIONS,
  type AuditAction,
  type CardAction,
  type CardHistoryAction,
  type CardStatus,
} from '@nfc-business/shared/constants';
import {
  cardCreateRequestSchema,
  cardListQuerySchema,
  cardUpdateRequestSchema,
  type Card,
  type CardCreateRequest,
  type CardHistory,
  type CardPage,
  type CardUpdateRequest,
} from '@nfc-business/shared/schemas';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { likePattern } from '../audit/audit.controller';
import { auditActorOf, dbContextOf, requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DatabaseService, type Queryable } from '../database/database.service';

type CardListQuery = z.output<typeof cardListQuerySchema>;

const STATUS_AFTER: Record<CardAction, CardStatus> = {
  activate: 'active',
  deactivate: 'inactive',
  lost: 'lost',
  block: 'blocked',
};
const HISTORY_OF: Record<CardAction, CardHistoryAction> = {
  activate: 'activated',
  deactivate: 'deactivated',
  lost: 'lost',
  block: 'blocked',
};
const AUDIT_OF: Record<CardAction, AuditAction> = {
  activate: 'card.activated',
  deactivate: 'card.deactivated',
  lost: 'card.lost',
  block: 'card.blocked',
};

interface CardRow {
  id: string;
  label: string;
  token: string;
  status: CardStatus;
  profile_id: string | null;
  profile_name: string | null;
  history: unknown;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `select c.id, c.label, c.token, c.status, c.profile_id, p.display_name as profile_name,
  c.history, c.created_at, c.updated_at
  from app.cards c left join app.profiles p on p.id = c.profile_id`;

/** Token público de 128 bits aleatórios em base64url (22 caracteres), nunca sequencial (regra 4). */
export function newCardToken(): string {
  return randomBytes(16).toString('base64url');
}

export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    label: row.label,
    token: row.token,
    status: row.status,
    profileId: row.profile_id,
    profileName: row.profile_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Entrada do histórico guardada no próprio cartão (jsonb). */
function historyEntry(action: CardHistoryAction, actor: SessionUser) {
  return {
    id: `h_${randomBytes(6).toString('hex')}`,
    action,
    actorName: actor.name || actor.email,
    createdAt: new Date().toISOString(),
  };
}

/** A empresa vem sempre da sessão (regra 2); sem empresa (platform_admin) não há cartões a gerir. */
function requireCompany(user: SessionUser): string {
  if (!user.companyId) throw new ForbiddenException({ error: { code: 'forbidden' } });
  return user.companyId;
}

const notFound = () => new NotFoundException({ error: { code: 'not_found' } });

/**
 * Cartões NFC (regra 4). Toda a operação verifica a posse (`id` e `company_id` da sessão) e corre com o contexto
 * RLS da empresa: um cartão de outra empresa dá sempre 404.
 */
@Controller('cards')
export class CardsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(cardListQuerySchema)) query: CardListQuery,
    @Req() req: AuthedRequest,
  ): Promise<CardPage> {
    const user = requirePermission(req, 'cards.view');
    const companyId = requireCompany(user);
    const offset = (query.page - 1) * query.pageSize;
    return this.database.withContext(dbContextOf(user), async (db) => {
      const where = `where c.company_id = $1 and ($2::text is null or c.status = $2)
        and ($3::text is null or c.label ilike $3 or p.display_name ilike $3)`;
      const params = [companyId, query.status ?? null, query.search ? likePattern(query.search) : null];
      const total = await db.query<{ n: number }>(
        `select count(*)::int as n from app.cards c left join app.profiles p on p.id = c.profile_id ${where}`,
        params,
      );
      const rows = await db.query<CardRow>(`${SELECT} ${where} order by c.updated_at desc, c.id limit $4 offset $5`, [
        ...params,
        query.pageSize,
        offset,
      ]);
      return { items: rows.rows.map(toCard), page: query.page, pageSize: query.pageSize, total: total.rows[0]?.n ?? 0 };
    });
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(cardCreateRequestSchema)) body: CardCreateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Card> {
    const user = requirePermission(req, 'cards.manage');
    const companyId = requireCompany(user);
    const card = await this.database.withContext(dbContextOf(user), async (db) => {
      const profileId = body.profileId ? await this.companyProfileOr404(db, companyId, body.profileId) : null;
      const history = [historyEntry('created', user)];
      if (profileId) history.push(historyEntry('profile_linked', user));
      const inserted = await db.query<{ id: string }>(
        `insert into app.cards (company_id, label, token, status, profile_id, history)
         values ($1, $2, $3, 'inactive', $4, $5::jsonb) returning id`,
        [companyId, body.label, newCardToken(), profileId, JSON.stringify(history)],
      );
      return this.findOr404(db, companyId, inserted.rows[0]!.id);
    });
    await this.audit.record({ action: 'card.created', actor: auditActorOf(user), target: card.label });
    return card;
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Card> {
    const user = requirePermission(req, 'cards.view');
    const companyId = requireCompany(user);
    return this.database.withContext(dbContextOf(user), (db) => this.findOr404(db, companyId, id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cardUpdateRequestSchema)) body: CardUpdateRequest,
    @Req() req: AuthedRequest,
  ): Promise<Card> {
    const user = requirePermission(req, 'cards.manage');
    const companyId = requireCompany(user);
    let changed = false;
    const card = await this.database.withContext(dbContextOf(user), async (db) => {
      const current = await this.lockOr404(db, companyId, id);
      const history: ReturnType<typeof historyEntry>[] = [];
      let profileId = current.profile_id;
      if (body.profileId === null) {
        if (current.status === 'active') throw new ConflictException({ error: { code: 'card_without_profile' } });
        if (current.profile_id !== null) {
          profileId = null;
          history.push(historyEntry('profile_unlinked', user));
        }
      } else if (body.profileId !== undefined && body.profileId !== current.profile_id) {
        profileId = await this.companyProfileOr404(db, companyId, body.profileId);
        history.push(historyEntry('profile_linked', user));
      }
      const label = body.label !== undefined && body.label !== current.label ? body.label : current.label;
      if (label !== current.label) history.push(historyEntry('updated', user));
      if (history.length > 0) {
        changed = true;
        await db.query(
          `update app.cards set label = $3, profile_id = $4, history = history || $5::jsonb, updated_at = now()
            where id = $1 and company_id = $2`,
          [id, companyId, label, profileId, JSON.stringify(history)],
        );
      }
      return this.findOr404(db, companyId, id);
    });
    if (changed) await this.audit.record({ action: 'card.updated', actor: auditActorOf(user), target: card.label });
    return card;
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Card> {
    return this.transition(id, 'activate', req);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Card> {
    return this.transition(id, 'deactivate', req);
  }

  @Post(':id/lost')
  @HttpCode(200)
  lost(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Card> {
    return this.transition(id, 'lost', req);
  }

  @Post(':id/block')
  @HttpCode(200)
  block(@Param('id') id: string, @Req() req: AuthedRequest): Promise<Card> {
    return this.transition(id, 'block', req);
  }

  @Get(':id/history')
  async history(@Param('id') id: string, @Req() req: AuthedRequest): Promise<CardHistory> {
    const user = requirePermission(req, 'cards.view');
    const companyId = requireCompany(user);
    const row = await this.database.withContext(dbContextOf(user), (db) => this.rowOr404(db, companyId, id));
    const entries = Array.isArray(row.history) ? (row.history as CardHistory['items']) : [];
    // Do mais recente para o mais antigo; empates pela ordem inversa de registo.
    const items = [...entries].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items };
  }

  /** Transições fechadas (`CARD_TRANSITIONS`); `blocked` é terminal; não se ativa um cartão sem perfil. */
  private async transition(id: string, action: CardAction, req: AuthedRequest): Promise<Card> {
    const user = requirePermission(req, 'cards.manage');
    const companyId = requireCompany(user);
    const card = await this.database.withContext(dbContextOf(user), async (db) => {
      const current = await this.lockOr404(db, companyId, id);
      if (!CARD_TRANSITIONS[current.status].includes(action)) {
        throw new ConflictException({ error: { code: 'invalid_transition' } });
      }
      if (action === 'activate' && current.profile_id === null) {
        throw new ConflictException({ error: { code: 'card_without_profile' } });
      }
      await db.query(
        `update app.cards set status = $3, history = history || $4::jsonb, updated_at = now()
          where id = $1 and company_id = $2`,
        [id, companyId, STATUS_AFTER[action], JSON.stringify([historyEntry(HISTORY_OF[action], user)])],
      );
      return this.findOr404(db, companyId, id);
    });
    await this.audit.record({ action: AUDIT_OF[action], actor: auditActorOf(user), target: card.label });
    return card;
  }

  private async rowOr404(db: Queryable, companyId: string, id: string, lock = false): Promise<CardRow> {
    const result = await db.query<CardRow>(
      `${SELECT} where c.id = $1 and c.company_id = $2${lock ? ' for update of c' : ''}`,
      [id, companyId],
    );
    const row = result.rows[0];
    if (!row) throw notFound();
    return row;
  }

  private lockOr404(db: Queryable, companyId: string, id: string): Promise<CardRow> {
    return this.rowOr404(db, companyId, id, true);
  }

  private async findOr404(db: Queryable, companyId: string, id: string): Promise<Card> {
    return toCard(await this.rowOr404(db, companyId, id));
  }

  /** Perfil do pedido: tem de ser da empresa da sessão, senão é como se não existisse (404). */
  private async companyProfileOr404(db: Queryable, companyId: string, profileId: string): Promise<string> {
    const result = await db.query<{ id: string }>('select id from app.profiles where id = $1 and company_id = $2', [
      profileId,
      companyId,
    ]);
    if (!result.rows[0]) throw notFound();
    return result.rows[0].id;
  }
}
