// Datas e números da interface, sempre em português de Moçambique (ADR-0008). Sem dependências.
const LOCALE = 'pt-MZ';

const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
// As datas civis (AAAA-MM-DD) são formatadas em UTC para o dia não mudar com o fuso horário.
const civilDateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat(LOCALE);

function parse(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? dateFormat.format(date) : '—';
}

export function formatDateTime(iso: string): string {
  const date = parse(iso);
  return date ? dateTimeFormat.format(date) : '—';
}

/** Data civil `AAAA-MM-DD`, por exemplo «11 de nov. de 2026». */
export function formatCivilDate(civilDate: string): string {
  const date = parse(civilDate);
  return date ? civilDateFormat.format(date) : '—';
}

/** Data civil abreviada para eixos de gráficos, por exemplo «11 nov.». */
export function formatDayShort(civilDate: string): string {
  const date = parse(civilDate);
  return date ? dayFormat.format(date) : '—';
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Data civil local `AAAA-MM-DD` de um instante. */
export function toCivilDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Duração aproximada em linguagem corrente: «30 segundos», «2 minutos», «1 hora». */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    const value = Math.max(1, Math.ceil(seconds));
    return value === 1 ? '1 segundo' : `${value} segundos`;
  }
  if (seconds < 3600) {
    const value = Math.ceil(seconds / 60);
    return value === 1 ? '1 minuto' : `${value} minutos`;
  }
  const value = Math.ceil(seconds / 3600);
  return value === 1 ? '1 hora' : `${value} horas`;
}
