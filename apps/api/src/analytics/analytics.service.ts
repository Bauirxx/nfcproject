// Estatísticas (CLAUDE.md, regra 6): agregação dos eventos por cartão e dia civil, com a visibilidade da sessão.
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { can } from '@nfc-business/shared/permissions';
import type { AnalyticsQuery, AnalyticsSummary, AnalyticsTotals } from '@nfc-business/shared/schemas';
import { dbContextOf } from '../common/access';
import type { SessionUser } from '../common/session-user';
import { DatabaseService } from '../database/database.service';

/** Fuso dos dias civis dos relatórios (Moçambique). */
export const REPORT_TIME_ZONE = 'Africa/Maputo';
export const MAX_RANGE_DAYS = 366;

type Metric = keyof AnalyticsTotals;
const METRICS: readonly Metric[] = ['views', 'clicks', 'vcfDownloads', 'contactsSent'];
const METRIC_OF_EVENT: Record<string, Metric> = {
  view: 'views',
  whatsapp_click: 'clicks',
  email_click: 'clicks',
  vcf_download: 'vcfDownloads',
  contact_sent: 'contactsSent',
};

export interface EventRow {
  card_id: string;
  card_label: string;
  profile_name: string | null;
  company_id: string;
  day: string | null;
  type: string | null;
  n: number;
}

const zero = (): AnalyticsTotals => ({ views: 0, clicks: 0, vcfDownloads: 0, contactsSent: 0 });
function add(target: AnalyticsTotals, source: AnalyticsTotals): void {
  for (const metric of METRICS) target[metric] += source[metric];
}

/** Dias civis de `from` a `to` (AAAA-MM-DD), inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Monta o resumo a partir das linhas agregadas (uma por cartão, dia e tipo; cartões sem eventos com dia nulo). */
export function buildSummary(
  query: AnalyticsQuery,
  rows: readonly EventRow[],
  companies: ReadonlyArray<{ id: string; name: string }> | null,
): AnalyticsSummary {
  const days = daysBetween(query.from, query.to);
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const series = days.map((date) => ({ date, ...zero() }));
  const totals = zero();
  const cards = new Map<string, { cardId: string; cardLabel: string; profileName: string | null; companyId: string } & AnalyticsTotals>();

  for (const row of rows) {
    let card = cards.get(row.card_id);
    if (!card) {
      card = { cardId: row.card_id, cardLabel: row.card_label, profileName: row.profile_name, companyId: row.company_id, ...zero() };
      cards.set(row.card_id, card);
    }
    const metric = row.type ? METRIC_OF_EVENT[row.type] : undefined;
    const index = row.day ? dayIndex.get(row.day) : undefined;
    if (!metric || index === undefined) continue;
    card[metric] += row.n;
    totals[metric] += row.n;
    const point = series[index];
    if (point) point[metric] += row.n;
  }

  const byCardFull = [...cards.values()].sort((a, b) => b.views - a.views || a.cardLabel.localeCompare(b.cardLabel, 'pt'));
  const summary: AnalyticsSummary = {
    range: { from: query.from, to: query.to },
    totals,
    series,
    byCard: byCardFull.map(({ companyId: _companyId, ...card }) => card),
  };
  if (companies) {
    summary.byCompany = companies.map((company) => {
      const companyTotals = zero();
      for (const card of byCardFull) if (card.companyId === company.id) add(companyTotals, card);
      return { companyId: company.id, companyName: company.name, ...companyTotals };
    });
  }
  return summary;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /**
   * Resumo visível para a sessão: platform_admin vê tudo (ou uma empresa); administradores e editores vêem a
   * sua empresa (RLS); donos de perfil só os cartões dos seus perfis.
   */
  async summary(user: SessionUser, query: AnalyticsQuery): Promise<AnalyticsSummary> {
    if (query.from > query.to) throw new BadRequestException({ error: { code: 'invalid_request' } });
    if (daysBetween(query.from, query.to).length > MAX_RANGE_DAYS) {
      throw new BadRequestException({ error: { code: 'invalid_request' } });
    }
    // O filtro por empresa é só para platform_admin; a empresa dos outros vem sempre da sessão.
    if (query.companyId !== undefined && !can(user.role, 'analytics.filterByCompany')) {
      throw new ForbiddenException({ error: { code: 'forbidden' } });
    }
    const ownerId = user.role === 'profile_owner' ? user.id : null;

    return this.database.withContext(dbContextOf(user), async (db) => {
      const result = await db.query<EventRow>(
        `select c.id as card_id, c.label as card_label, p.display_name as profile_name, c.company_id,
                to_char((e.created_at at time zone $5)::date, 'YYYY-MM-DD') as day, e.type, count(e.id)::int as n
           from app.cards c
           left join app.profiles p on p.id = c.profile_id
           left join app.analytics_events e
             on e.card_id = c.id
            and e.created_at >= ($1::date)::timestamp at time zone $5
            and e.created_at <  ($2::date + 1)::timestamp at time zone $5
          where ($3::text is null or c.company_id = $3)
            and ($4::text is null or c.id = $4)
            and ($6::uuid is null or p.owner_user_id = $6)
          group by c.id, c.label, p.display_name, c.company_id, day, e.type`,
        [query.from, query.to, query.companyId ?? null, query.cardId ?? null, REPORT_TIME_ZONE, ownerId],
      );
      // Cartão pedido que não existe ou não é visível: 404 (nunca revela o de outra empresa).
      if (query.cardId !== undefined && result.rows.length === 0) {
        throw new NotFoundException({ error: { code: 'not_found' } });
      }
      let companies: Array<{ id: string; name: string }> | null = null;
      if (user.role === 'platform_admin') {
        const list = await db.query<{ id: string; name: string }>(
          `select id, name from app.companies where ($1::text is null or id = $1) order by name`,
          [query.companyId ?? null],
        );
        companies = list.rows;
      }
      return buildSummary(query, result.rows, companies);
    });
  }
}
