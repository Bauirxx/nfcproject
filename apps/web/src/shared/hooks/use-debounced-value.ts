import { useEffect, useState } from 'react';

/** Devolve o valor depois de parar de mudar durante `delay` ms (para pesquisas sem um pedido por tecla). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
