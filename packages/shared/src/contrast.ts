// Contraste de cor segundo as WCAG 2.2. Usado na verificação dos temas e na página pública.
import { isHexColor } from './validators';

export type Rgb = readonly [number, number, number];

export const CONTRAST_AA_TEXT = 4.5;
export const CONTRAST_AA_LARGE = 3;

export function parseHexColor(hex: string): Rgb | null {
  if (!isHexColor(hex)) return null;
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste entre duas cores `#rrggbb`, de 1 a 21. `null` se alguma cor for inválida. */
export function contrastRatio(a: string, b: string): number | null {
  const first = parseHexColor(a);
  const second = parseHexColor(b);
  if (!first || !second) return null;
  const l1 = relativeLuminance(first);
  const l2 = relativeLuminance(second);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(a: string, b: string, minimum: number = CONTRAST_AA_TEXT): boolean {
  const ratio = contrastRatio(a, b);
  return ratio !== null && ratio >= minimum;
}

/** Preto ou branco, o que tiver mais contraste sobre o fundo dado. */
export function readableTextOn(background: string): '#000000' | '#ffffff' {
  const onWhite = contrastRatio(background, '#ffffff') ?? 1;
  const onBlack = contrastRatio(background, '#000000') ?? 1;
  return onBlack >= onWhite ? '#000000' : '#ffffff';
}
