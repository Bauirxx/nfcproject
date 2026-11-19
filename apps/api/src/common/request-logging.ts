// Identificador e log de acesso de cada pedido (CLAUDE.md, regra 11; ADR-0021).
// - Gera sempre o seu próprio request_id (nunca aceita o do cliente, que poderia forjar ou baralhar os logs) e
//   devolve-o no cabeçalho X-Request-Id, para o suporte encontrar o pedido nos logs.
// - Regista a rota padrão (`/api/public/cards/:token`), nunca o caminho concreto nem a query string: tokens dos
//   cartões, códigos de cancelamento e ids não chegam aos logs. Sem IP nem cabeçalhos.
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { SessionUser } from './session-user';
import type { JsonLogger } from './json-logger';
import { runWithRequestContext } from './request-context';
import type { RequestMonitor } from './request-monitor';

const HEALTH_ROUTE = '/api/health';
/** Identificador do pedido no Vercel, só para correlação; aceite apenas se tiver um formato inofensivo. */
const EDGE_ID_PATTERN = /^[A-Za-z0-9:._-]{1,128}$/;

/** Rota padrão do Express (definida depois do encaminhamento) ou um marcador para pedidos sem rota. */
export function routeOf(request: Request): string {
  const path: unknown = (request.route as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' ? `${request.baseUrl ?? ''}${path}` : '(sem rota)';
}

export function requestLogging(logger: JsonLogger, monitor: RequestMonitor) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    const started = process.hrtime.bigint();
    response.setHeader('X-Request-Id', requestId);

    response.on('finish', () => {
      runWithRequestContext({ requestId }, () => {
        const route = routeOf(request);
        const status = response.statusCode;
        const user = (request as Request & { user?: SessionUser }).user;
        const companyId = user?.companyId ?? null;
        if (!(route === HEALTH_ROUTE && status < 400)) {
          const edgeId = request.get('x-vercel-id');
          logger.event(status >= 500 ? 'error' : status === 429 ? 'warn' : 'info', 'request', {
            method: request.method,
            route,
            status,
            duration_ms: Math.round(Number(process.hrtime.bigint() - started) / 1e4) / 100,
            ...(user ? { user_id: user.id, company_id: companyId } : {}),
            ...(edgeId && EDGE_ID_PATTERN.test(edgeId) ? { edge_id: edgeId } : {}),
          }, 'Http');
        }
        monitor.observe({ method: request.method, route, status, companyId });
      });
    });

    runWithRequestContext({ requestId }, () => next());
  };
}
