import { analyticsSummarySchema } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { likePattern } from '../audit/audit.controller';
import { toCompany } from '../companies/companies.controller';
import { buildSummary, daysBetween, type EventRow } from './analytics.service';

const row = (overrides: Partial<EventRow>): EventRow => ({
  card_id: 'c_a',
  card_label: 'Cartão A',
  profile_name: 'Paula',
  company_id: 'co_a',
  day: '2026-11-17',
  type: 'view',
  n: 1,
  ...overrides,
});

describe('daysBetween', () => {
  it('inclui os dois extremos e atravessa meses', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(daysBetween('2026-11-02', '2026-11-01')).toEqual([]);
  });
});

describe('buildSummary', () => {
  const query = { from: '2026-11-16', to: '2026-11-18' };

  it('soma por métrica, dia e cartão, com série sem dias em falta, no contrato', () => {
    const summary = buildSummary(
      query,
      [
        row({ n: 3 }),
        row({ type: 'whatsapp_click', n: 1 }),
        row({ type: 'email_click', day: '2026-11-18', n: 2 }),
        row({ type: 'vcf_download', day: '2026-11-18', n: 1 }),
        row({ type: 'contact_sent', day: '2026-11-16', n: 1 }),
        // Cartão sem eventos no período: aparece com zeros.
        row({ card_id: 'c_b', card_label: 'Cartão B', profile_name: null, day: null, type: null, n: 0 }),
      ],
      null,
    );
    expect(analyticsSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary.totals).toEqual({ views: 3, clicks: 3, vcfDownloads: 1, contactsSent: 1 });
    expect(summary.series.map((point) => point.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(summary.series[1]).toMatchObject({ views: 3, clicks: 1 });
    expect(summary.byCard.map((card) => card.cardId)).toEqual(['c_a', 'c_b']);
    expect(summary.byCard[1]).toMatchObject({ views: 0, profileName: null });
    expect(summary.byCompany).toBeUndefined();
    // O company_id interno não sai na lista por cartão.
    expect(JSON.stringify(summary.byCard)).not.toContain('co_a');
  });

  it('ignora tipos desconhecidos e dias fora do intervalo; agrega por empresa para platform_admin', () => {
    const summary = buildSummary(
      query,
      [row({ type: 'hack', n: 99 }), row({ day: '2026-12-01', n: 50 }), row({ n: 2 })],
      [
        { id: 'co_a', name: 'ACME' },
        { id: 'co_z', name: 'Zeta' },
      ],
    );
    expect(summary.totals.views).toBe(2);
    expect(summary.byCompany).toEqual([
      { companyId: 'co_a', companyName: 'ACME', views: 2, clicks: 0, vcfDownloads: 0, contactsSent: 0 },
      { companyId: 'co_z', companyName: 'Zeta', views: 0, clicks: 0, vcfDownloads: 0, contactsSent: 0 },
    ]);
  });
});

describe('likePattern', () => {
  it('escapa os curingas para uma pesquisa literal', () => {
    expect(likePattern('ana')).toBe('%ana%');
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});

describe('toCompany', () => {
  it('converte a linha e usa a marca por defeito quando falta ou é inválida', () => {
    const company = toCompany({
      id: 'co_a',
      name: 'ACME',
      contact_email: 'geral@acme.test',
      logo_url: null,
      brand: { primaryColor: '#123456', accentColor: 'vermelho' },
      created_at: new Date('2026-01-01T00:00:00Z'),
      cards_count: 2,
      members_count: 3,
    });
    expect(company).toMatchObject({
      contactEmail: 'geral@acme.test',
      brand: { primaryColor: '#123456', accentColor: '#0f766e' },
      cardsCount: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
