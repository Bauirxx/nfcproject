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

/** Estado e código estável de uma exceção. Nunca expõe texto do servidor (CLAUDE.md, regra 9). */
export function resolveError(exception: unknown): { status: number; code: string } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = extractCode(exception.getResponse()) ?? CODE_BY_STATUS[status] ?? 'error';
    return { status, code };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'internal_error' };
}

/** Respostas de erro no formato do contrato (ADR-0004): `{ "error": { "code": "..." } }`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code } = resolveError(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }
    response.status(status).json({ error: { code } });
  }
}
