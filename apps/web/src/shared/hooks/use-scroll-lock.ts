import { useEffect } from 'react';

// Contador partilhado: vários diálogos abertos não se desbloqueiam uns aos outros cedo demais.
let lockCount = 0;

/** Bloqueia o scroll do fundo enquanto `active`. Usa a classe `html.scroll-locked` (sem CSS em runtime, ADR-0006). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    lockCount += 1;
    document.documentElement.classList.add('scroll-locked');
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.documentElement.classList.remove('scroll-locked');
    };
  }, [active]);
}
