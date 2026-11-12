import { z } from 'zod';
import { AUDIT_ACTIONS } from '../constants';
import {
  dateSchema,
  dateTimeSchema,
  idSchema,
  paginatedSchema,
  paginationQuerySchema,
  type Paginated,
} from './common';

// Estatísticas

const count = z.number().int().min(0);

const totalsShape = {
  views: count,
  clicks: count,
  vcfDownloads: count,
  contactsSent: count,
};

export const analyticsTotalsSchema = z.object(totalsShape);
export type AnalyticsTotals = z.infer<typeof analyticsTotalsSchema>;

export const analyticsQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  cardId: idSchema.optional(),
  /** Só para platform_admin. */
  companyId: idSchema.optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const analyticsSummarySchema = z.object({
  range: z.object({ from: dateSchema, to: dateSchema }),
  totals: analyticsTotalsSchema,
  /** Um ponto por dia, por ordem crescente e sem dias em falta. */
  series: z.array(z.object({ date: dateSchema, ...totalsShape })),
  byCard: z.array(
    z.object({ cardId: idSchema, cardLabel: z.string(), profileName: z.string().nullable(), ...totalsShape }),
  ),
  /** Só é devolvido a platform_admin. */
  byCompany: z.array(z.object({ companyId: idSchema, companyName: z.string(), ...totalsShape })).optional(),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

// Auditoria

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export const auditEntrySchema = z.object({
  id: idSchema,
  action: auditActionSchema,
  actorName: z.string(),
  actorEmail: z.string(),
  /** Descrição curta do alvo, por exemplo o nome do cartão. */
  target: z.string().nullable(),
  companyName: z.string().nullable(),
  createdAt: dateTimeSchema,
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditPageSchema = paginatedSchema(auditEntrySchema);
export type AuditPage = Paginated<AuditEntry>;

export const auditQuerySchema = paginationQuerySchema.extend({
  action: auditActionSchema.optional(),
  actor: z.string().trim().max(80).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type AuditQuery = z.input<typeof auditQuerySchema>;
