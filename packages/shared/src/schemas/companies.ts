import { z } from 'zod';
import { LIMITS, MEMBER_ROLES } from '../constants';
import { isSingleLineText } from '../validators';
import { dateTimeSchema, emailSchema, hexColorSchema, idSchema } from './common';

// Empresas (só platform_admin)

export const companyBrandSchema = z.object({
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
});
export type CompanyBrand = z.infer<typeof companyBrandSchema>;

export const companyNameSchema = z
  .string()
  .trim()
  .min(LIMITS.nameMin, 'too_short')
  .max(LIMITS.companyMax, 'too_long')
  .refine(isSingleLineText, 'invalid_text');

export const companySchema = z.object({
  id: idSchema,
  name: z.string(),
  contactEmail: z.string(),
  logoUrl: z.string().nullable(),
  brand: companyBrandSchema,
  cardsCount: z.number().int().min(0),
  membersCount: z.number().int().min(0),
  createdAt: dateTimeSchema,
});
export type Company = z.infer<typeof companySchema>;

export const companyListSchema = z.object({ items: z.array(companySchema) });
export type CompanyList = z.infer<typeof companyListSchema>;

export const companyCreateRequestSchema = z.object({
  name: companyNameSchema,
  contactEmail: emailSchema,
  /** Primeiro administrador da empresa: recebe um convite (o registo é só por convite). */
  adminEmail: emailSchema,
  brand: companyBrandSchema,
  logoFileId: idSchema.nullable().optional(),
});
export type CompanyCreateRequest = z.infer<typeof companyCreateRequestSchema>;

export const companyUpdateRequestSchema = z.object({
  name: companyNameSchema.optional(),
  contactEmail: emailSchema.optional(),
  brand: companyBrandSchema.optional(),
  /** `null` remove o logótipo. */
  logoFileId: idSchema.nullable().optional(),
});
export type CompanyUpdateRequest = z.infer<typeof companyUpdateRequestSchema>;

// Membros (company_admin)

export const memberRoleSchema = z.enum(MEMBER_ROLES);

export const memberSchema = z.object({
  id: idSchema,
  name: z.string().nullable(),
  email: z.string(),
  role: memberRoleSchema,
  status: z.enum(['active', 'invited']),
  createdAt: dateTimeSchema,
});
export type Member = z.infer<typeof memberSchema>;

export const memberListSchema = z.object({ items: z.array(memberSchema) });
export type MemberList = z.infer<typeof memberListSchema>;

export const memberInviteRequestSchema = z.object({
  email: emailSchema,
  role: memberRoleSchema,
});
export type MemberInviteRequest = z.infer<typeof memberInviteRequestSchema>;

export const memberUpdateRequestSchema = z.object({ role: memberRoleSchema });
export type MemberUpdateRequest = z.infer<typeof memberUpdateRequestSchema>;
