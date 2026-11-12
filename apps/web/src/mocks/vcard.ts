// Gerador de vCard 4.0 (RFC 6350) da API simulada. Faz o papel do backend (CLAUDE.md, regra 4): escapa todos os
// campos, remove caracteres de controlo e dobra as linhas a 75 octetos. Só recebe dados já marcados como públicos.
import type { PublicContact, PublicSocialLink } from '@nfc-business/shared/schemas';
import { isE164 } from '@nfc-business/shared/validators';

export interface VCardInput {
  displayName: string;
  title: string | null;
  company: string | null;
  contacts: readonly PublicContact[];
  socialLinks: readonly PublicSocialLink[];
  /** URL da página pública do cartão, incluído como ligação do contacto. */
  cardUrl: string;
  /** Data da última alteração do perfil (ISO 8601). */
  revision: string;
}

const MAX_LINE_OCTETS = 75;
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Escapa um valor de texto (RFC 6350, §3.4): barra invertida, vírgula, ponto e vírgula e quebras de linha. */
export function escapeVCardText(value: string): string {
  return value
    .replace(CONTROL_PATTERN, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[;,]/g, (char) => `\\${char}`);
}

/** Dobra uma linha com mais de 75 octetos (RFC 6350, §3.2): continuação com CRLF seguido de um espaço. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > MAX_LINE_OCTETS) {
      parts.push(current);
      current = ' ';
      octets = 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n');
}

/** `AAAAMMDDThhmmssZ`, o formato de data e hora do vCard. */
function toVCardTimestamp(iso: string): string {
  const date = new Date(iso);
  const safe = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return safe.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** `N`: último nome como apelido, o resto como nome próprio; um só nome fica só no nome próprio. */
function structuredName(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const family = words.length > 1 ? (words.pop() ?? '') : '';
  return `N:${escapeVCardText(family)};${escapeVCardText(words.join(' '))};;;`;
}

export function buildVCard(input: VCardInput): string {
  const esc = escapeVCardText;
  const lines = ['BEGIN:VCARD', 'VERSION:4.0', 'PRODID:-//NFC Business//API simulada//PT', `FN:${esc(input.displayName)}`];
  lines.push(structuredName(input.displayName));
  if (input.company) lines.push(`ORG:${esc(input.company)}`);
  if (input.title) lines.push(`TITLE:${esc(input.title)}`);

  const phones = new Set<string>();
  for (const contact of input.contacts) {
    switch (contact.type) {
      case 'phone':
      case 'whatsapp':
        // Só números E.164, que não precisam de escape; o mesmo número não se repete.
        if (isE164(contact.value) && !phones.has(contact.value)) {
          phones.add(contact.value);
          lines.push(`TEL;TYPE=cell,voice;VALUE=uri:tel:${contact.value}`);
        }
        break;
      case 'email':
        lines.push(`EMAIL;TYPE=work:${esc(contact.value)}`);
        break;
      case 'website':
        lines.push(`URL;TYPE=work:${esc(contact.value)}`);
        break;
      case 'location':
        lines.push(`ADR;TYPE=work:;;${esc(contact.value)};;;;`);
        break;
    }
  }
  for (const link of input.socialLinks) {
    lines.push(`X-SOCIALPROFILE;TYPE=${link.platform}:${esc(link.url)}`);
  }
  lines.push(`URL;TYPE=x-nfc-card:${esc(input.cardUrl)}`);
  lines.push(`REV:${toVCardTimestamp(input.revision)}`);
  lines.push('END:VCARD');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
