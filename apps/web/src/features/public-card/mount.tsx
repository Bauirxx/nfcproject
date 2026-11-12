import { createRoot } from 'react-dom/client';
import { PublicCardPage } from './public-card-page';
import type { PublicKind } from './public-events';

/** Monta a página pública. Importada estaticamente por `main.tsx` (ADR-0003); sem router nem painel. */
export function mountPublicCard(container: HTMLElement, params: { kind: PublicKind; id: string }): void {
  createRoot(container).render(<PublicCardPage kind={params.kind} id={params.id} />);
}
