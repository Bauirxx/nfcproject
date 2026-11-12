import { z } from 'zod';
import { CARD_ACTIONS, CARD_HISTORY_ACTIONS, CARD_STATUSES, LIMITS } from '../constants';
import { isSingleLineText } from '../validators';
import { dateTimeSchema, idSchema, paginatedSchema, paginationQuerySchema, type Paginated } from './common';

export const cardStatusSchema = z.enum(CARD_STATUSES);
export const cardActionSchema = z.enum(CARD_ACTIONS);

export const cardLabelSchema = z
  .string()
  .trim()
  .min(LIMITS.nameMin, 'too_short')
  .max(LIMITS.cardLabelMax, 'too_long')
  .refine(isSingleLineText, 'invalid_text');

export const cardSchema = z.object({
  id: idSchema,
  label: z.string(),
  /** Token público de 128 bits. O URL a gravar no chip é `<origem>/c/<token>`. */
  token: z.string(),
  status: cardStatusSchema,
  profileId: idSchema.nullable(),
  profileName: z.string().nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});
export type Card = z.infer<typeof cardSchema>;

export const cardPageSchema = paginatedSchema(cardSchema);
export type CardPage = Paginated<Card>;

export const cardListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  status: cardStatusSchema.optional(),
});
export type CardListQuery = z.input<typeof cardListQuerySchema>;

export const cardCreateRequestSchema = z.object({
  label: cardLabelSchema,
  profileId: idSchema.nullable().optional(),
});
export type CardCreateRequest = z.infer<typeof cardCreateRequestSchema>;

export const cardUpdateRequestSchema = z.object({
  label: cardLabelSchema.optional(),
  /** `null` desassocia o perfil. */
  profileId: idSchema.nullable().optional(),
});
export type CardUpdateRequest = z.infer<typeof cardUpdateRequestSchema>;

export const cardHistoryEntrySchema = z.object({
  id: idSchema,
  action: z.enum(CARD_HISTORY_ACTIONS),
  actorName: z.string(),
  createdAt: dateTimeSchema,
});
export type CardHistoryEntry = z.infer<typeof cardHistoryEntrySchema>;

export const cardHistorySchema = z.object({ items: z.array(cardHistoryEntrySchema) });
export type CardHistory = z.infer<typeof cardHistorySchema>;
