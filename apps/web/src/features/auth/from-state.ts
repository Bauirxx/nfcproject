// Destino pretendido guardado no estado da navegação quando um guard envia para o login.
export interface FromState {
  from?: { pathname?: string };
}

/** Caminho para onde voltar depois de iniciar sessão. Só caminhos internos; por omissão, o painel. */
export function redirectTarget(state: unknown): string {
  const pathname = (state as FromState | null)?.from?.pathname;
  if (typeof pathname === 'string' && pathname.startsWith('/') && !pathname.startsWith('//')) {
    return pathname;
  }
  return '/painel';
}
