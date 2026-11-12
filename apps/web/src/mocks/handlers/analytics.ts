// Handler de estatísticas da API simulada (FRONTEND «Dashboard» e «Estatísticas»; CLAUDE.md, regra 6).
// Base determinística por cartão e dia (para a demonstração) mais os eventos registados durante a simulação.
import type { HttpHandler } from 'msw';
import { can } from '@nfc-business/shared/permissions';
import { analyticsQuerySchema, type AnalyticsSummary, type AnalyticsTotals } from '@nfc-business/shared/schemas';
import type { DbCard, DbUser, MockDb } from '../db';
import { civilDate, counterKey, type Metric } from '../domain';
import { profileNameOf } from './cards';
import { fail, json, readQuery, requireCompany, requirePermission, route } from './http';
import { visibleProfiles } from './profiles';

const MAX_RANGE_DAYS = 366;
const METRICS: readonly Metric[] = ['views', 'clicks', 'vcfDownloads', 'contactsSent'];

function zero(): AnalyticsTotals {
  return { views: 0, clicks: 0, vcfDownloads: 0, contactsSent: 0 };
}

function add(target: AnalyticsTotals, source: AnalyticsTotals): void {
  for (const metric of METRICS) target[metric] += source[metric];
}

/** Hash determinístico (FNV-1a) de um texto para um número em [0, 1). */
function noise(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 4_294_967_296;
}

function parseDate(date: string): Date {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

/** Dias civis de `from` a `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = parseDate(from);
  const end = parseDate(to);
  while (cursor <= end) {
    days.push(civilDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Atividade de demonstração: só nos cartões com `demoWeight`, entre a criação do cartão e hoje, menor ao fim de semana. */
function demoTotals(card: DbCard, date: string, today: string): AnalyticsTotals {
  if (card.demoWeight <= 0 || date > today || date < card.createdAt.slice(0, 10)) return zero();
  const weekday = parseDate(date).getDay();
  const weekend = weekday === 0 || weekday === 6 ? 0.35 : 1;
  const views = Math.round(card.demoWeight * weekend * (4 + 10 * noise(`${card.id}|${date}|v`)));
  const clicks = Math.round(views * (0.2 + 0.25 * noise(`${card.id}|${date}|c`)));
  const vcfDownloads = Math.round(views * (0.1 + 0.15 * noise(`${card.id}|${date}|d`)));
  const contactsSent = noise(`${card.id}|${date}|s`) < 0.12 * card.demoWeight ? 1 : 0;
  return { views, clicks, vcfDownloads, contactsSent };
}

function totalsFor(db: MockDb, card: DbCard, date: string, today: string): AnalyticsTotals {
  const totals = demoTotals(card, date, today);
  for (const metric of METRICS) totals[metric] += db.counters[counterKey(card.id, date, metric)] ?? 0;
  return totals;
}

/** Cartões cujas estatísticas o utilizador pode ver: todos (platform_admin), os da empresa, ou os dos seus perfis. */
function visibleCards(db: MockDb, user: DbUser, companyId: string | undefined): DbCard[] {
  if (user.role === 'platform_admin') {
    return db.cards.filter((card) => companyId === undefined || card.companyId === companyId);
  }
  if (user.role === 'profile_owner') {
    const profileIds = new Set(visibleProfiles(db, user).map((profile) => profile.id));
    return db.cards.filter((card) => card.profileId !== null && profileIds.has(card.profileId));
  }
  const ownCompanyId = requireCompany(user);
  return db.cards.filter((card) => card.companyId === ownCompanyId);
}

export const analyticsHandlers: HttpHandler[] = [
  route('get', '/api/analytics/summary', ({ db, url }) => {
    const user = requirePermission(db, 'analytics.view');
    const query = readQuery(url, analyticsQuerySchema);
    if (query.from > query.to) fail(400, 'invalid_request');
    const days = daysBetween(query.from, query.to);
    if (days.length > MAX_RANGE_DAYS) fail(400, 'invalid_request');
    // O filtro por empresa é só para platform_admin; a empresa dos outros vem sempre da sessão.
    if (query.companyId !== undefined && !can(user.role, 'analytics.filterByCompany')) fail(403, 'forbidden');

    let cards = visibleCards(db, user, query.companyId);
    if (query.cardId !== undefined) {
      cards = [cards.find((card) => card.id === query.cardId) ?? fail(404, 'not_found')];
    }

    const today = civilDate();
    const totals = zero();
    const series = days.map((date) => ({ date, ...zero() }));
    const byCard = cards
      .map((card) => {
        const cardTotals = zero();
        days.forEach((date, index) => {
          const day = totalsFor(db, card, date, today);
          add(cardTotals, day);
          const point = series[index];
          if (point) add(point, day);
        });
        add(totals, cardTotals);
        return { cardId: card.id, cardLabel: card.label, profileName: profileNameOf(db, card.profileId), ...cardTotals };
      })
      .sort((a, b) => b.views - a.views);

    const summary: AnalyticsSummary = { range: { from: query.from, to: query.to }, totals, series, byCard };
    if (user.role === 'platform_admin') {
      const companyOfCard = new Map(cards.map((card) => [card.id, card.companyId]));
      summary.byCompany = db.companies
        .filter((company) => query.companyId === undefined || company.id === query.companyId)
        .map((company) => {
          const companyTotals = zero();
          for (const row of byCard) if (companyOfCard.get(row.cardId) === company.id) add(companyTotals, row);
          return { companyId: company.id, companyName: company.name, ...companyTotals };
        });
    }
    return json(summary);
  }),
];
