// Handlers de cartões NFC da API simulada (FRONTEND «Cartões»; CLAUDE.md, regra 4).
import type { HttpHandler } from 'msw';
import {
  CARD_ACTIONS,
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
  type CardHistory,
} from '@nfc-business/shared/schemas';
import { nextId, randomToken, type DbCard, type DbProfile, type DbUser, type MockDb } from '../db';
import { isoNow, recordAudit } from '../domain';
import { fail, json, paginate, readBody, readQuery, requireCompany, requirePermission, route } from './http';

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

export function profileNameOf(db: MockDb, profileId: string | null): string | null {
  if (profileId === null) return null;
  return db.profiles.find((profile) => profile.id === profileId)?.displayName ?? null;
}

export function toCard(db: MockDb, card: DbCard): Card {
  return {
    id: card.id,
    label: card.label,
    token: card.token,
    status: card.status,
    profileId: card.profileId,
    profileName: profileNameOf(db, card.profileId),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

/** Cartão da empresa da sessão; os de outras empresas dão 404 (CLAUDE.md, regra 2). */
function cardOr404(db: MockDb, companyId: string, id: string): DbCard {
  return db.cards.find((card) => card.id === id && card.companyId === companyId) ?? fail(404, 'not_found');
}

/** Perfil referido no pedido: tem de ser da mesma empresa, senão é como se não existisse. */
function companyProfileOr404(db: MockDb, companyId: string, profileId: string): DbProfile {
  return (
    db.profiles.find((profile) => profile.id === profileId && profile.companyId === companyId) ??
    fail(404, 'not_found')
  );
}

function addHistory(card: DbCard, action: CardHistoryAction, actor: DbUser): void {
  const now = isoNow();
  card.history.push({ id: nextId('h'), action, actorName: actor.name ?? actor.email, createdAt: now });
  card.updatedAt = now;
}

function matchesSearch(db: MockDb, card: DbCard, search: string): boolean {
  const needle = search.toLowerCase();
  if (card.label.toLowerCase().includes(needle)) return true;
  return (profileNameOf(db, card.profileId) ?? '').toLowerCase().includes(needle);
}

function cardAction(action: CardAction): HttpHandler {
  return route('post', `/api/cards/:id/${action}`, ({ db, param }) => {
    const actor = requirePermission(db, 'cards.manage');
    const card = cardOr404(db, requireCompany(actor), param('id'));
    if (!CARD_TRANSITIONS[card.status].includes(action)) fail(409, 'invalid_transition');
    // Um cartão ativo sem perfil mostraria a página neutra: não faz sentido ativá-lo (P-11).
    if (action === 'activate' && card.profileId === null) fail(409, 'card_without_profile');
    card.status = STATUS_AFTER[action];
    addHistory(card, HISTORY_OF[action], actor);
    recordAudit(db, actor, AUDIT_OF[action], card.label);
    return json(toCard(db, card));
  });
}

export const cardHandlers: HttpHandler[] = [
  route('get', '/api/cards', ({ db, url }) => {
    const companyId = requireCompany(requirePermission(db, 'cards.view'));
    const query = readQuery(url, cardListQuerySchema);
    const cards = db.cards
      .filter((card) => card.companyId === companyId)
      .filter((card) => query.status === undefined || card.status === query.status)
      .filter((card) => !query.search || matchesSearch(db, card, query.search))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((card) => toCard(db, card));
    return json(paginate(cards, query.page, query.pageSize));
  }),

  route('post', '/api/cards', async ({ db, request }) => {
    const actor = requirePermission(db, 'cards.manage');
    const companyId = requireCompany(actor);
    const body = await readBody(request, cardCreateRequestSchema);
    const profile = body.profileId ? companyProfileOr404(db, companyId, body.profileId) : null;
    const now = isoNow();
    const card: DbCard = {
      id: nextId('c'),
      companyId,
      label: body.label,
      // 128 bits aleatórios em base64url: 22 caracteres (CLAUDE.md, regra 4).
      token: randomToken(16),
      status: 'inactive',
      profileId: profile?.id ?? null,
      demoWeight: 0,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    addHistory(card, 'created', actor);
    if (profile) addHistory(card, 'profile_linked', actor);
    db.cards.push(card);
    recordAudit(db, actor, 'card.created', card.label);
    return json(toCard(db, card), 201);
  }),

  route('get', '/api/cards/:id', ({ db, param }) => {
    const companyId = requireCompany(requirePermission(db, 'cards.view'));
    return json(toCard(db, cardOr404(db, companyId, param('id'))));
  }),

  route('patch', '/api/cards/:id', async ({ db, request, param }) => {
    const actor = requirePermission(db, 'cards.manage');
    const companyId = requireCompany(actor);
    const card = cardOr404(db, companyId, param('id'));
    const body = await readBody(request, cardUpdateRequestSchema);
    let changed = false;

    if (body.profileId === null) {
      if (card.status === 'active') fail(409, 'card_without_profile');
      if (card.profileId !== null) {
        card.profileId = null;
        addHistory(card, 'profile_unlinked', actor);
        changed = true;
      }
    } else if (body.profileId !== undefined && body.profileId !== card.profileId) {
      card.profileId = companyProfileOr404(db, companyId, body.profileId).id;
      addHistory(card, 'profile_linked', actor);
      changed = true;
    }

    if (body.label !== undefined && body.label !== card.label) {
      card.label = body.label;
      addHistory(card, 'updated', actor);
      changed = true;
    }

    if (changed) recordAudit(db, actor, 'card.updated', card.label);
    return json(toCard(db, card));
  }),

  ...CARD_ACTIONS.map(cardAction),

  route('get', '/api/cards/:id/history', ({ db, param }) => {
    const companyId = requireCompany(requirePermission(db, 'cards.view'));
    const card = cardOr404(db, companyId, param('id'));
    // Do mais recente para o mais antigo; entradas com o mesmo instante ficam pela ordem inversa de registo.
    const items = [...card.history].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ items } satisfies CardHistory);
  }),
];
