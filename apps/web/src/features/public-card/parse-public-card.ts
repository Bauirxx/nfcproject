// Validação da resposta pública sem Zod (ADR-0003: a página pública não carrega Zod).
// Guarda de tipo manual mais saneamento das cores do tema.
import { CONTACT_TYPES, DEFAULT_THEME, SOCIAL_PLATFORM_KEYS, type ContactType, type SocialPlatform } from '@nfc-business/shared/constants';
import { isHexColor } from '@nfc-business/shared/validators';
import type { ProfileTheme, PublicCard } from '@nfc-business/shared/schemas';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && isHexColor(value) ? value : fallback;
}

function parseTheme(value: unknown): ProfileTheme {
  const raw = isRecord(value) ? value : {};
  const template = DEFAULT_THEME.template;
  return {
    template: typeof raw.template === 'string' ? (raw.template as ProfileTheme['template']) : template,
    primaryColor: safeColor(raw.primaryColor, DEFAULT_THEME.primaryColor),
    backgroundColor: safeColor(raw.backgroundColor, DEFAULT_THEME.backgroundColor),
    textColor: safeColor(raw.textColor, DEFAULT_THEME.textColor),
    logoUrl: stringOrNull(raw.logoUrl),
  };
}

function parseContacts(value: unknown): PublicCard['contacts'] {
  if (!Array.isArray(value)) return [];
  const contacts: PublicCard['contacts'] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.value !== 'string') continue;
    if (!(CONTACT_TYPES as readonly string[]).includes(item.type as string)) continue;
    contacts.push({ type: item.type as ContactType, value: item.value });
  }
  return contacts;
}

function parseSocialLinks(value: unknown): PublicCard['socialLinks'] {
  if (!Array.isArray(value)) return [];
  const links: PublicCard['socialLinks'] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.url !== 'string') continue;
    if (!(SOCIAL_PLATFORM_KEYS as readonly string[]).includes(item.platform as string)) continue;
    links.push({ platform: item.platform as SocialPlatform, url: item.url });
  }
  return links;
}

/** Devolve o cartão público já saneado, ou `null` se a resposta não tiver a forma esperada. */
export function parsePublicCard(data: unknown): PublicCard | null {
  if (!isRecord(data)) return null;
  if (typeof data.profileId !== 'string' || typeof data.displayName !== 'string' || data.displayName.trim() === '') {
    return null;
  }
  return {
    profileId: data.profileId,
    displayName: data.displayName,
    title: stringOrNull(data.title),
    company: stringOrNull(data.company),
    bio: stringOrNull(data.bio),
    photoUrl: stringOrNull(data.photoUrl),
    contacts: parseContacts(data.contacts),
    socialLinks: parseSocialLinks(data.socialLinks),
    theme: parseTheme(data.theme),
  };
}
