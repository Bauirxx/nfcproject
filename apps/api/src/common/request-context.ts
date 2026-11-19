// Contexto do pedido em curso (CLAUDE.md, regra 11: logs com request_id). O AsyncLocalStorage acompanha o pedido
// através de todo o código assíncrono, por isso qualquer log feito durante o pedido leva o mesmo request_id.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Identificador do pedido em curso, ou `undefined` fora de um pedido (arranque, tarefas internas). */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
