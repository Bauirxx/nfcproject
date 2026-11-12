import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Lê o `?token=` do link de uso único (recuperação, convite), guarda-o em memória e retira-o do URL,
 * para não ficar no histórico nem ser partilhado por engano. Devolve `null` se o link não trouxer token.
 */
export function useUrlToken(): string | null {
  const [params, setParams] = useSearchParams();
  // Inicializador: corre uma vez e fixa o token antes de o retirarmos do URL.
  const [token] = useState<string | null>(() => params.get('token'));

  useEffect(() => {
    if (!params.has('token')) return;
    const next = new URLSearchParams(params);
    next.delete('token');
    setParams(next, { replace: true });
  }, [params, setParams]);

  return token;
}
