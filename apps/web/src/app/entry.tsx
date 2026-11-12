import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Providers } from './providers';
import { createQueryClient } from './query-client';
import { createRouter } from './router';
import { watchSession } from './session-events';
import { initTheme } from './theme';

/** Monta o painel. Carregado por `import()` dinâmico a partir de `main.tsx` (ADR-0003). */
export function renderPanel(container: HTMLElement): void {
  initTheme();
  const queryClient = createQueryClient();
  watchSession(queryClient);
  const router = createRouter();

  createRoot(container).render(
    <StrictMode>
      <Providers client={queryClient}>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
}
