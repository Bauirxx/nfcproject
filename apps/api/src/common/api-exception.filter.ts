import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Código genérico por estado, quando a exceção não traz um código próprio. */
const CODE_BY_STATUS: Record<number, string> = {
  400: 'invalid_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'validation_failed',
  429: 'rate_limited',
};

function extractCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

const RATE_LIMIT_SCOPES = new Set(['hour', 'day', 'company']);

/** Detalhes permitidos no corpo do erro: só o `scope` dos limites de envio (ADR-0004). */
function extractScope(body: unknown): string | null {
  const error = typeof body === 'object' && body !== null ? (body as { error?: { scope?: unknown } }).error : undefined;
  return typeof error?.scope === 'string' && RATE_LIMIT_SCOPES.has(error.scope) ? error.scope : null;
}

function extractRetryAfter(body: unknown): number | null {
  const value = typeof body === 'object' && body !== null ? (body as { retryAfter?: unknown }).retryAfter : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

/** Estado e código estável de uma exceção. Nunca expõe texto do servidor (CLAUDE.md, regra 9). */
export function resolveError(exception: unknown): {
  status: number;
  code: string;
  scope?: string;
  retryAfter?: number;
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const code = extractCode(body) ?? CODE_BY_STATUS[status] ?? 'error';
    const scope = extractScope(body);
    const retryAfter = extractRetryAfter(body);
    return { status, code, ...(scope ? { scope } : {}), ...(retryAfter ? { retryAfter } : {}) };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'internal_error' };
}

/** Respostas de erro no formato do contrato (ADR-0004): `{ "error": { "code": "..." } }`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code, scope, retryAfter } = resolveError(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }
    if (retryAfter) response.setHeader('Retry-After', String(retryAfter));
    response.status(status).json({ error: scope ? { code, scope } : { code } });
  }
}
