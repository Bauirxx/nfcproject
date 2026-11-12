import { z } from 'zod';
import {
  CONTACT_TYPES,
  LIMITS,
  PUBLIC_EVENT_TYPES,
  SOCIAL_PLATFORM_KEYS,
  THEME_TEMPLATES,
  UPLOAD_MIME_TYPES,
  UPLOAD_PURPOSES,
  type ContactType,
} from '../constants';
import { CONTRAST_AA_LARGE, CONTRAST_AA_TEXT, meetsContrast } from '../contrast';
import {
  isAllowedSocialUrl,
  isCardToken,
  isE164,
  isEmail,
  isHttpsUrl,
  isMultilineText,
  isSingleLineText,
  isSlug,
} from '../validators';
import {
  dateTimeSchema,
  hexColorSchema,
  idSchema,
  paginatedSchema,
  paginationQuerySchema,
  personNameSchema,
  type Paginated,
} from './common';

// Contactos e redes sociais

export const contactTypeSchema = z.enum(CONTACT_TYPES);
export const socialPlatformSchema = z.enum(SOCIAL_PLATFORM_KEYS);

/** Código do problema do valor de um contacto, ou `null` se for válido para o tipo. */
export function contactValueIssue(type: ContactType, value: string): string | null {
  switch (type) {
    case 'phone':
    case 'whatsapp':
      return isE164(value) ? null : 'invalid_phone';
    case 'email':
      return isEmail(value) ? null : 'invalid_email';
    case 'website':
      return isHttpsUrl(value) ? null : 'invalid_url';
    case 'location':
      return value.length >= 3 && value.length <= LIMITS.locationMax && isSingleLineText(value)
        ? null
        : 'invalid_location';
  }
}

export const profileContactSchema = z
  .object({
    id: idSchema,
    type: contactTypeSchema,
    value: z.string().trim().min(1, 'required').max(LIMITS.urlMax, 'too_long'),
    isPublic: z.boolean(),
  })
  .superRefine((contact, ctx) => {
    const issue = contactValueIssue(contact.type, contact.value);
    if (issue) ctx.addIssue({ code: 'custom', message: issue, path: ['value'] });
  });
export type ProfileContact = z.infer<typeof profileContactSchema>;

export const profileSocialLinkSchema = z
  .object({
    id: idSchema,
    platform: socialPlatformSchema,
    url: z.string().trim().min(1, 'required').max(LIMITS.urlMax, 'too_long'),
    isPublic: z.boolean(),
  })
  .superRefine((link, ctx) => {
    if (!isAllowedSocialUrl(link.platform, link.url)) {
      ctx.addIssue({ code: 'custom', message: 'invalid_social_url', path: ['url'] });
    }
  });
export type ProfileSocialLink = z.infer<typeof profileSocialLinkSchema>;

// Tema

export const themeTemplateSchema = z.enum(THEME_TEMPLATES);

const themeColorsShape = {
  template: themeTemplateSchema,
  primaryColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
};

export const profileThemeSchema = z.object({ ...themeColorsShape, logoUrl: z.string().nullable() });
export type ProfileTheme = z.infer<typeof profileThemeSchema>;

/** O tema só é aceite se cumprir o contraste AA: texto sobre fundo 4,5:1 e cor principal sobre fundo 3:1. */
export const profileThemeInputSchema = z
  .object({
    ...themeColorsShape,
    /** `null` remove o logótipo; omitido mantém o atual. */
    logoFileId: idSchema.nullable().optional(),
  })
  .superRefine((theme, ctx) => {
    if (!meetsContrast(theme.textColor, theme.backgroundColor, CONTRAST_AA_TEXT)) {
      ctx.addIssue({ code: 'custom', message: 'low_contrast_text', path: ['textColor'] });
    }
    if (!meetsContrast(theme.primaryColor, theme.backgroundColor, CONTRAST_AA_LARGE)) {
      ctx.addIssue({ code: 'custom', message: 'low_contrast_primary', path: ['primaryColor'] });
    }
  });
export type ProfileThemeInput = z.infer<typeof profileThemeInputSchema>;

// Perfil

export const profileVisibilitySchema = z.object({
  title: z.boolean(),
  company: z.boolean(),
  bio: z.boolean(),
  photo: z.boolean(),
});
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

const optionalLine = (max: number) =>
  z.string().trim().max(max, 'too_long').refine(isSingleLineText, 'invalid_text').nullable();

export const profileSchema = z.object({
  id: idSchema,
  slug: z.string(),
  ownerUserId: idSchema.nullable(),
  ownerName: z.string().nullable(),
  /** O nome é sempre público. */
  displayName: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  visibility: profileVisibilitySchema,
  contacts: z.array(profileContactSchema),
  socialLinks: z.array(profileSocialLinkSchema),
  theme: profileThemeSchema,
  /** Token do cartão ativo usado nos links de partilha; `null` se o perfil não tiver nenhum cartão ativo. */
  activeCardToken: z.string().nullable(),
  cardsCount: z.number().int().min(0),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const profilePageSchema = paginatedSchema(profileSchema);
export type ProfilePage = Paginated<Profile>;

export const profileListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
});
export type ProfileListQuery = z.input<typeof profileListQuerySchema>;

export const profileFieldsSchema = z.object({
  displayName: personNameSchema,
  title: optionalLine(LIMITS.titleMax),
  company: optionalLine(LIMITS.companyMax),
  bio: z.string().trim().max(LIMITS.bioMax, 'too_long').refine(isMultilineText, 'invalid_text').nullable(),
  visibility: profileVisibilitySchema,
  contacts: z.array(profileContactSchema).max(LIMITS.contactsMax, 'too_many'),
  socialLinks: z.array(profileSocialLinkSchema).max(LIMITS.socialLinksMax, 'too_many'),
});
export type ProfileFields = z.infer<typeof profileFieldsSchema>;

export const profileCreateRequestSchema = z.object({
  displayName: personNameSchema,
  ownerUserId: idSchema.nullable().optional(),
});
export type ProfileCreateRequest = z.infer<typeof profileCreateRequestSchema>;

export const profileUpdateRequestSchema = profileFieldsSchema.partial().extend({
  ownerUserId: idSchema.nullable().optional(),
  /** `null` remove a fotografia. */
  photoFileId: idSchema.nullable().optional(),
  theme: profileThemeInputSchema.optional(),
});
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;

// Página pública: só campos marcados como públicos

export const publicContactSchema = z.object({ type: contactTypeSchema, value: z.string() });
export type PublicContact = z.infer<typeof publicContactSchema>;

export const publicSocialLinkSchema = z.object({ platform: socialPlatformSchema, url: z.string() });
export type PublicSocialLink = z.infer<typeof publicSocialLinkSchema>;

export const publicCardSchema = z.object({
  profileId: idSchema,
  displayName: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  contacts: z.array(publicContactSchema),
  socialLinks: z.array(publicSocialLinkSchema),
  theme: profileThemeSchema,
});
export type PublicCard = z.infer<typeof publicCardSchema>;

export const publicEventTypeSchema = z.enum(PUBLIC_EVENT_TYPES);

export const publicEventRequestSchema = z.union([
  z.object({ type: publicEventTypeSchema, token: z.string().refine(isCardToken, 'invalid_value') }),
  z.object({ type: publicEventTypeSchema, slug: z.string().refine(isSlug, 'invalid_value') }),
]);
export type PublicEventRequest = z.infer<typeof publicEventRequestSchema>;

// Uploads: JPEG, PNG ou WebP até 2 MB, por URL assinado (CLAUDE.md, regra 8)

export const uploadSignRequestSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.enum(UPLOAD_MIME_TYPES),
  size: z.number().int().min(1).max(LIMITS.uploadMaxBytes, 'file_too_large'),
});
export type UploadSignRequest = z.infer<typeof uploadSignRequestSchema>;

export const uploadSignResponseSchema = z.object({
  fileId: idSchema,
  /** Caminho na mesma origem, sempre por baixo de `/api/`. */
  uploadUrl: z.string().regex(/^\/api\/[A-Za-z0-9/_.~%?=&-]+$/, 'invalid_value'),
});
export type UploadSignResponse = z.infer<typeof uploadSignResponseSchema>;
