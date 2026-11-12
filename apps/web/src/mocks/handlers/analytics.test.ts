import type { AnalyticsSummary, AnalyticsTotals } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { bumpCounter, civilDate } from '../domain';
import { analyticsHandlers, daysBetween } from './analytics';
import { api, errorCode, readJson, signIn, useMockServer } from './testing';

useMockServer(analyticsHandlers);

const DAY_MS = 86_400_000;
const today = civilDate();
const weekAgo = civilDate(new Date(Date.now() - 6 * DAY_MS));
const tomorrow = civilDate(new Date(Date.now() + DAY_MS));

function sumOf(rows: AnalyticsTotals[]): AnalyticsTotals {
  return rows.reduce(
    (acc, row) => ({
      views: acc.views + row.views,
      clicks: acc.clicks + row.clicks,
      vcfDownloads: acc.vcfDownloads + row.vcfDownloads,
      contactsSent: acc.contactsSent + row.contactsSent,
    }),
    { views: 0, clicks: 0, vcfDownloads: 0, contactsSent: 0 },
  );
}

async function summary(query: string = `from=${weekAgo}&to=${today}`): Promise<AnalyticsSummary> {
  const response = await api('GET', `/api/analytics/summary?${query}`);
  expect(response.status).toBe(200);
  return readJson<AnalyticsSummary>(response);
}

describe('daysBetween', () => {
  it('devolve todos os dias civis do intervalo, inclusive', () => {
    expect(daysBetween('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(daysBetween('2026-11-12', '2026-11-12')).toEqual(['2026-11-12']);
    expect(daysBetween('2026-11-13', '2026-11-12')).toEqual([]);
  });
});

describe('GET /api/analytics/summary', () => {
  it('exige sessão e valida o intervalo', async () => {
    expect((await api('GET', `/api/analytics/summary?from=${weekAgo}&to=${today}`)).status).toBe(401);
    signIn('u_ana');
    expect((await api('GET', '/api/analytics/summary')).status).toBe(400);
    const inverted = await api('GET', `/api/analytics/summary?from=${today}&to=${weekAgo}`);
    expect(inverted.status).toBe(400);
    expect(await errorCode(inverted)).toBe('invalid_request');
    expect((await api('GET', '/api/analytics/summary?from=2020-01-01&to=2026-01-01')).status).toBe(400);
    expect((await api('GET', `/api/analytics/summary?from=${weekAgo}&to=${today}&foo=1`)).status).toBe(200);
  });

  it('devolve série diária completa e totais coerentes só com os cartões da empresa', async () => {
    signIn('u_ana');
    const result = await summary();
    expect(result.range).toEqual({ from: weekAgo, to: today });
    expect(result.series.map((point) => point.date)).toEqual(daysBetween(weekAgo, today));
    expect(result.series).toHaveLength(7);
    expect(sumOf(result.series)).toEqual(result.totals);
    expect(sumOf(result.byCard)).toEqual(result.totals);
    expect(result.totals.views).toBeGreaterThan(0);

    const ids = result.byCard.map((row) => row.cardId);
    expect(ids).toHaveLength(28);
    expect(ids).not.toContain('c_rita');
    expect(result.byCard[0]).toMatchObject({ cardId: 'c_paula', profileName: 'Paula Machava' });
    expect(result.byCard.find((row) => row.cardId === 'c_stock_001')?.views).toBe(0);
    expect(result.byCompany).toBeUndefined();
  });

  it('é determinística e soma os eventos registados durante a simulação', async () => {
    signIn('u_edu');
    const first = await summary();
    expect(await summary()).toEqual(first);

    const db = getDb();
    for (let count = 0; count < 5; count += 1) bumpCounter(db, 'c_paula', 'views', today);
    bumpCounter(db, 'c_paula', 'clicks', today);
    bumpCounter(db, 'c_stock_001', 'vcfDownloads', today);
    const after = await summary();
    expect(after.totals).toEqual({
      views: first.totals.views + 5,
      clicks: first.totals.clicks + 1,
      vcfDownloads: first.totals.vcfDownloads + 1,
      contactsSent: first.totals.contactsSent,
    });
    expect(after.series[6]?.views).toBe((first.series[6]?.views ?? 0) + 5);
    expect(after.byCard.find((row) => row.cardId === 'c_stock_001')?.vcfDownloads).toBe(1);
  });

  it('não inventa atividade no futuro nem antes da criação do cartão', async () => {
    signIn('u_ana');
    const future = await summary(`from=${tomorrow}&to=${tomorrow}`);
    expect(future.totals).toEqual({ views: 0, clicks: 0, vcfDownloads: 0, contactsSent: 0 });
    const past = await summary('from=2024-01-01&to=2024-01-07');
    expect(past.totals.views).toBe(0);
  });

  it('filtra por cartão, só entre os que o utilizador pode ver', async () => {
    signIn('u_ana');
    const one = await summary(`from=${weekAgo}&to=${today}&cardId=c_carlos`);
    expect(one.byCard.map((row) => row.cardId)).toEqual(['c_carlos']);
    expect(sumOf(one.byCard)).toEqual(one.totals);
    for (const cardId of ['c_rita', 'c_inexistente']) {
      const response = await api('GET', `/api/analytics/summary?from=${weekAgo}&to=${today}&cardId=${cardId}`);
      expect(response.status).toBe(404);
      expect(await errorCode(response)).toBe('not_found');
    }
  });

  it('o dono só vê os cartões dos seus perfis', async () => {
    signIn('u_paula');
    expect((await summary()).byCard.map((row) => row.cardId).sort()).toEqual(['c_paula', 'c_paula2']);
    signIn('u_carlos');
    expect((await summary()).byCard.map((row) => row.cardId).sort()).toEqual(['c_carlos', 'c_lost']);
    expect((await api('GET', `/api/analytics/summary?from=${weekAgo}&to=${today}&cardId=c_paula`)).status).toBe(404);
  });

  it('platform_admin vê todas as empresas, com totais por empresa e filtro por empresa', async () => {
    signIn('u_marta');
    const all = await summary();
    expect(all.byCard).toHaveLength(30);
    expect(all.byCompany?.map((row) => row.companyId)).toEqual(['co_acme', 'co_beta']);
    expect(sumOf(all.byCompany ?? [])).toEqual(all.totals);

    const beta = await summary(`from=${weekAgo}&to=${today}&companyId=co_beta`);
    expect(beta.byCard.map((row) => row.cardId).sort()).toEqual(['c_beta_stock', 'c_rita']);
    expect(beta.byCompany).toHaveLength(1);
    expect(beta.byCompany?.[0]).toMatchObject({ companyId: 'co_beta', companyName: 'Beta Logística', views: beta.totals.views });
  });

  it('os outros papéis não filtram por empresa', async () => {
    signIn('u_ana');
    const response = await api('GET', `/api/analytics/summary?from=${weekAgo}&to=${today}&companyId=co_beta`);
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('forbidden');
  });
});
