// As mensagens dos schemas são códigos estáveis (por exemplo `invalid_email`), não texto de interface.
// O frontend traduz cada código no dicionário de validação; o backend pode devolvê-los tal como estão.
import { z } from 'zod';
import { LIMITS, RATE_LIMIT_SCOPES } from '../constants';
import { isE164, isEmail, isHexColor, isHttpsUrl, isSingleLineText } from '../validators';

export const idSchema = z.string().min(1, 'required').max(64, 'too_long');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'required')
  .max(LIMITS.emailMax, 'too_long')
  .refine(isEmail, 'invalid_email');

export const phoneSchema = z.string().refine(isE164, 'invalid_phone');

export const httpsUrlSchema = z.string().trim().max(LIMITS.urlMax, 'too_long').refine(isHttpsUrl, 'invalid_url');

export const hexColorSchema = z.string().refine(isHexColor, 'invalid_color');

export const dateTimeSchema = z.iso.datetime({ offset: true });

/** Data civil `AAAA-MM-DD`. */
export const dateSchema = z.iso.date();

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, 'password_too_short')
  .max(LIMITS.passwordMax, 'password_too_long');

export const personNameSchema = z
  .string()
  .trim()
  .min(LIMITS.nameMin, 'too_short')
  .max(LIMITS.nameMax, 'too_long')
  .refine(isSingleLineText, 'invalid_text');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(20),
});

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  });
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().max(64),
    scope: z.enum(RATE_LIMIT_SCOPES).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
