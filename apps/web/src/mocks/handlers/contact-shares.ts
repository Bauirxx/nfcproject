// Handlers de envio de contacto da API simulada (CLAUDE.md, «Módulo de envio de contacto» e regra 5).
import type { HttpHandler } from 'msw';
import { LIMITS } from '@nfc-business/shared/constants';
import { maskRecipient } from '@nfc-business/shared/links';
import {
  contactShareListQuerySchema,
  contactShareRequestSchema,
  type ContactShare,
} from '@nfc-business/shared/schemas';
import { nextId, type DbShare, type MockDb } from '../db';
import { activeCardOf, bumpCounter, isoNow, recordAudit } from '../domain';
import { fail, hitLimit, json, paginate, readBody, readQuery, requirePermission, route } from './http';
import { profileOr404, visibleProfiles } from './profiles';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function toShare(db: MockDb, share: DbShare): ContactShare {
  return {
    id: share.id,
    profileId: share.profileId,
    profileName: db.profiles.find((profile) => profile.id === share.profileId)?.displayName ?? '',
    channel: share.channel,
    recipientMasked: share.recipientMasked,
    createdAt: share.createdAt,
  };
}

/** 10 envios por hora e 50 por dia por utilizador (CLAUDE.md, regra 5). Só os envios aceites contam. */
function limitShares(db: MockDb, userId: string): void {
  const hourKey = `share:hour:${userId}`;
  const hourWait = hitLimit(db, hourKey, LIMITS.sharesPerHour, HOUR_MS);
  if (hourWait !== null) fail(429, 'rate_limited', { scope: 'hour', retryAfter: hourWait });
  const dayWait = hitLimit(db, `share:day:${userId}`, LIMITS.sharesPerDay, DAY_MS);
  if (dayWait !== null) {
    // O envio não aconteceu: a tentativa registada no limite horário é anulada.
    db.attempts[hourKey]?.pop();
    fail(429, 'rate_limited', { scope: 'day', retryAfter: dayWait });
  }
}

export const contactShareHandlers: HttpHandler[] = [
  // Regista o envio em todos os canais (o email em si não é simulado) e o evento contact_sent.
  route('post', '/api/contact-shares', async ({ db, request }) => {
    const actor = requirePermission(db, 'contact.send');
    const body = await readBody(request, contactShareRequestSchema);
    const profile = profileOr404(db, actor, body.profileId);
    const card = activeCardOf(db, profile.id) ?? fail(409, 'profile_without_card');
    limitShares(db, actor.id);
    const share: DbShare = {
      id: nextId('sh'),
      companyId: profile.companyId,
      userId: actor.id,
      profileId: profile.id,
      cardId: card.id,
      channel: body.channel,
      // Só o valor mascarado fica guardado: o destinatário completo nunca fica no browser.
      recipientMasked: maskRecipient(body.recipient),
      createdAt: isoNow(),
    };
    db.shares.unshift(share);
    bumpCounter(db, card.id, 'contactsSent');
    recordAudit(db, actor, 'contact.sent', profile.displayName);
    return json(toShare(db, share), 201);
  }),

  // Histórico: o dono vê os envios dos seus perfis; editores e administradores, os da empresa.
  route('get', '/api/contact-shares', ({ db, url }) => {
    const user = requirePermission(db, 'contact.send');
    const query = readQuery(url, contactShareListQuerySchema);
    const visibleIds = new Set(visibleProfiles(db, user).map((profile) => profile.id));
    if (query.profileId !== undefined && !visibleIds.has(query.profileId)) fail(404, 'not_found');
    const shares = db.shares
      .filter((share) => visibleIds.has(share.profileId))
      .filter((share) => query.profileId === undefined || share.profileId === query.profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((share) => toShare(db, share));
    return json(paginate(shares, query.page, query.pageSize));
  }),
];
