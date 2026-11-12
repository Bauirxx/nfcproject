// Validadores sem dependências, usados pelo frontend (incluindo a página pública) e pelo backend.
import { DEFAULT_PHONE_PREFIX, LIMITS, SOCIAL_PLATFORMS, type SocialPlatform } from './constants';

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
// Parte local conservadora: sem `?`, `&`, `=` nem `%`, que teriam significado num link mailto:.
const EMAIL_PATTERN =
  /^[A-Za-z0-9._+'-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PHONE_INPUT_PATTERN = /^[+\d\s().-]+$/;
// eslint-disable-next-line no-control-regex
const URL_FORBIDDEN_PATTERN = /[\s\u0000-\u001F\u007F<>"`\\]/;
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE_PATTERN = /[\u0000-\u0009\u000B-\u001F\u007F]/;
const LINK_PATTERN =
  /(?:[a-z][a-z0-9+.-]*:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|info|biz|io|co|me|ly|app|dev|link|site|online|xyz|mz|pt|br|za|uk)\b)/i;

/** Número em E.164: `+`, indicativo e 8 a 15 dígitos no total. */
export function isE164(value: string): boolean {
  return E164_PATTERN.test(value);
}

/**
 * Converte o que o utilizador escreveu para E.164. Sem `+` nem `00`, assume o indicativo por defeito (+258).
 * Devolve `null` se o resultado não for um número válido.
 */
export function normalizePhone(input: string, defaultPrefix: string = DEFAULT_PHONE_PREFIX): string | null {
  const trimmed = input.trim();
  if (trimmed === '' || !PHONE_INPUT_PATTERN.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  const prefixDigits = defaultPrefix.replace(/\D/g, '');

  let candidate: string;
  if (trimmed.startsWith('+')) {
    candidate = `+${digits}`;
  } else if (digits.startsWith('00')) {
    candidate = `+${digits.slice(2)}`;
  } else if (digits.startsWith(prefixDigits) && digits.length > 9) {
    // Já inclui o indicativo, por exemplo 258841234567.
    candidate = `+${digits}`;
  } else {
    candidate = `+${prefixDigits}${digits.replace(/^0+/, '')}`;
  }
  return isE164(candidate) ? candidate : null;
}

export function isEmail(value: string): boolean {
  if (value.length > LIMITS.emailMax) return false;
  const at = value.lastIndexOf('@');
  if (at < 1 || at > 64) return false;
  if (value.startsWith('.') || value.includes('..') || value[at - 1] === '.') return false;
  return EMAIL_PATTERN.test(value);
}

/** Aceita apenas URLs https absolutos, sem credenciais e com um domínio real. */
export function parseHttpsUrl(value: string): URL | null {
  if (value.length > LIMITS.urlMax || URL_FORBIDDEN_PATTERN.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) return null;
  return url;
}

export function isHttpsUrl(value: string): boolean {
  return parseHttpsUrl(value) !== null;
}

/** O link tem de ser https e pertencer a um dos domínios permitidos para a rede social. */
export function isAllowedSocialUrl(platform: SocialPlatform, value: string): boolean {
  const url = parseHttpsUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return SOCIAL_PLATFORMS[platform].domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Token de cartão: 128 bits em base64url, ou seja, 22 caracteres. */
export function isCardToken(value: string): boolean {
  return CARD_TOKEN_PATTERN.test(value);
}

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function containsLink(value: string): boolean {
  return LINK_PATTERN.test(value);
}

export function containsHtml(value: string): boolean {
  return /[<>]/.test(value);
}

/** Texto de uma linha (nomes, cargos): sem caracteres de controlo. */
export function isSingleLineText(value: string): boolean {
  return !CONTROL_PATTERN.test(value);
}

/** Texto com quebras de linha (descrição): sem outros caracteres de controlo. */
export function isMultilineText(value: string): boolean {
  return !CONTROL_EXCEPT_NEWLINE_PATTERN.test(value);
}

/** Nota opcional do envio de contacto: texto simples até 200 caracteres, sem links nem HTML (CLAUDE.md, regra 6). */
export function isValidNote(value: string): boolean {
  return value.length <= LIMITS.noteMax && isMultilineText(value) && !containsHtml(value) && !containsLink(value);
}
