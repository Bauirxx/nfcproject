// Logs estruturados: uma linha JSON por evento, com request_id (CLAUDE.md, regra 11; ADR-0021).
// Substitui o logger do Nest em toda a aplicação: os `new Logger('Contexto')` existentes passam a sair em JSON.
// O JSON.stringify escapa quebras de linha e aspas, por isso um valor vindo do utilizador nunca forja uma linha.
import type { LoggerService } from '@nestjs/common';
import { currentRequestId } from './request-context';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 };
/** Campos que só o logger preenche: um evento nunca os pode substituir. */
const RESERVED = new Set(['time', 'level', 'context', 'msg', 'request_id']);
const MAX_MESSAGE = 4_000;
const MAX_STACK = 8_000;
const MAX_FIELD = 1_000;

export type LogFields = Record<string, unknown>;

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function fieldValue(value: unknown): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return clip(value, MAX_FIELD);
  if (value instanceof Date) return value.toISOString();
  // Objetos e listas não entram: evita despejar acidentalmente pedidos, linhas da base de dados ou segredos.
  return undefined;
}

/** Monta a linha JSON de um evento. Exportado para os testes. */
export function formatLogLine(
  level: LogLevel,
  message: unknown,
  context: string | undefined,
  extra: { stack?: string; fields?: LogFields } = {},
  now: Date = new Date(),
): string {
  const record: Record<string, unknown> = { time: now.toISOString(), level };
  if (context) record.context = context;

  let msg: string;
  let stack = extra.stack;
  const fields: LogFields = { ...extra.fields };
  if (message instanceof Error) {
    msg = message.message;
    stack ??= message.stack;
  } else if (typeof message === 'object' && message !== null) {
    const { msg: inner, ...rest } = message as LogFields;
    msg = typeof inner === 'string' ? inner : '';
    Object.assign(fields, rest);
  } else {
    msg = String(message);
  }
  record.msg = clip(msg, MAX_MESSAGE);

  const requestId = currentRequestId();
  if (requestId) record.request_id = requestId;
  for (const [key, value] of Object.entries(fields)) {
    if (RESERVED.has(key)) continue;
    const safe = fieldValue(value);
    if (safe !== undefined) record[key] = safe;
  }
  if (stack) record.stack = clip(stack, MAX_STACK);
  return JSON.stringify(record);
}

/** Último parâmetro string = contexto (convenção do Logger do Nest). */
function splitParams(params: unknown[]): { context?: string; rest: unknown[] } {
  const last = params.at(-1);
  if (typeof last === 'string') return { context: last, rest: params.slice(0, -1) };
  return { rest: params.filter((param) => param !== undefined) };
}

export class JsonLogger implements LoggerService {
  private readonly minLevel: number;

  constructor(
    level: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    private readonly write: (line: string) => void = (line) => {
      process.stdout.write(`${line}\n`);
    },
  ) {
    this.minLevel = LEVEL_ORDER[level];
  }

  /** Evento estruturado (log de acesso, alertas). */
  event(level: LogLevel, msg: string, fields: LogFields = {}, context?: string): void {
    if (LEVEL_ORDER[level] > this.minLevel) return;
    this.write(formatLogLine(level, msg, context, { fields }));
  }

  log(message: unknown, ...params: unknown[]): void {
    this.emit('info', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.emit('warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.emit('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.emit('debug', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.emit('fatal', message, params);
  }

  /** O Nest chama `error(mensagem, stack?, contexto?)`. */
  error(message: unknown, ...params: unknown[]): void {
    const { context, rest } = splitParams(params);
    const stack = typeof rest[0] === 'string' ? rest[0] : undefined;
    if (LEVEL_ORDER.error > this.minLevel) return;
    this.write(formatLogLine('error', message, context, { stack }));
  }

  private emit(level: LogLevel, message: unknown, params: unknown[]): void {
    if (LEVEL_ORDER[level] > this.minLevel) return;
    const { context } = splitParams(params);
    this.write(formatLogLine(level, message, context));
  }
}
