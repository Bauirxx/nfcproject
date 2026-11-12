import { useEffect } from 'react';
import { commonTexts } from '@/shared/i18n/panel/common';

/**
 * Página provisória enquanto o ecrã real não existe (T-FE-06 em diante). Mantém o router e o menu
 * funcionais e testáveis. Cada tarefa seguinte substitui o elemento da sua rota.
 */
export function PlaceholderPage({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · ${commonTexts.appName}`;
  }, [title]);

  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">Esta área está a ser construída.</p>
    </section>
  );
}
