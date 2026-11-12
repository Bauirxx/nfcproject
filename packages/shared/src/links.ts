// Construção de links a partir de dados validados. Sem dependências: pode ser importado pela página pública.
// Cada função devolve `null` quando os dados não são válidos; quem chama não mostra o link nesse caso.
import { isCardToken, isE164, isEmail, isSlug, parseHttpsUrl } from './validators';

const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export function buildCardUrl(origin: string, token: string): string | null {
  return isCardToken(token) ? `${origin}/c/${token}` : null;
}

export function buildProfileUrl(origin: string, slug: string): string | null {
  return isSlug(slug) ? `${origin}/p/${slug}` : null;
}

export function toSafeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return parseHttpsUrl(value)?.href ?? null;
}

/** Imagens: https, caminho na mesma origem, ou `data:`/`blob:` de imagem raster (pré-visualizações). Nunca SVG. */
export function toSafeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  if (value.startsWith('blob:')) return value;
  if (value.startsWith('data:')) return IMAGE_DATA_URL_PATTERN.test(value) ? value : null;
  return toSafeHttpsUrl(value);
}

export function buildTelUrl(phone: string): string | null {
  return isE164(phone) ? `tel:${phone}` : null;
}

/** Link do WhatsApp construído apenas a partir de um número E.164 (CLAUDE.md, regra 4). */
export function buildWhatsAppUrl(phone: string, text?: string): string | null {
  if (!isE164(phone)) return null;
  const base = `https://wa.me/${phone.slice(1)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** `sms:+258...?&body=...` é a forma aceite tanto pelo iOS como pelo Android. */
export function buildSmsUrl(phone: string, body?: string): string | null {
  if (!isE164(phone)) return null;
  return body ? `sms:${phone}?&body=${encodeURIComponent(body)}` : `sms:${phone}`;
}

export function buildMailtoUrl(email: string): string | null {
  if (!isEmail(email)) return null;
  const at = email.lastIndexOf('@');
  return `mailto:${encodeURIComponent(email.slice(0, at))}@${email.slice(at + 1)}`;
}

export function buildMapsUrl(address: string): string | null {
  const query = address.trim();
  if (query === '') return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** `+258841234567` → `+258 84 123 4567`. Outros indicativos são agrupados de três em três. */
export function formatPhoneDisplay(phone: string): string {
  if (!isE164(phone)) return phone;
  if (phone.startsWith('+258') && phone.length === 13) {
    return `+258 ${phone.slice(4, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
  }
  const groups = phone.slice(1).match(/\d{1,3}/g) ?? [];
  return `+${groups.join(' ')}`;
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const maskedDomain = dot > 0 ? `${domain.slice(0, 1)}•••${domain.slice(dot)}` : '•••';
  return `${email.slice(0, 1)}•••@${maskedDomain}`;
}

export function maskPhone(phone: string): string {
  if (!isE164(phone)) return '•••';
  return `${phone.slice(0, 4)} ••• •• ${phone.slice(-3)}`;
}

export function maskRecipient(recipient: { email?: string | undefined; phone?: string | undefined }): string {
  if (recipient.email) return maskEmail(recipient.email);
  if (recipient.phone) return maskPhone(recipient.phone);
  return '•••';
}

export interface ShareMessageInput {
  senderName: string;
  recipientName?: string | null | undefined;
  cardUrl: string;
  note?: string | null | undefined;
}

/** Texto único da mensagem de envio de contacto, usado na pré-visualização, no WhatsApp, no SMS e no email. */
export function buildShareMessage({ senderName, recipientName, cardUrl, note }: ShareMessageInput): string {
  const name = recipientName?.trim();
  const lines = [name ? `Olá ${name},` : 'Olá,', `${senderName} partilhou consigo o seu cartão de visita digital:`, cardUrl];
  const trimmedNote = note?.trim();
  if (trimmedNote) lines.push('', trimmedNote);
  return lines.join('\n');
}
