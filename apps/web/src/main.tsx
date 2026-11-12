// Ponto de entrada. Decide pelo caminho (ADR-0003): a página pública é renderizada estaticamente
// (leve, sem router nem painel) e qualquer outro caminho carrega o painel por `import()` dinâmico.
// Só `import()` dinâmico sai do orçamento da página pública.
import './styles/index.css';
import { mountPublicCard } from './features/public-card/mount';

// `/c/<token>` (cartão) e `/p/<slug>` (perfil).
const PUBLIC_PATH = /^\/(c|p)\/([^/]+)\/?$/;

async function bootstrap(): Promise<void> {
  // Em desenvolvimento e e2e, a API é simulada com MSW antes de a aplicação arrancar (ADR-0009).
  if (__API_MOCKING__) {
    const { startMockApi } = await import('@/mocks/browser');
    await startMockApi();
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Elemento #root em falta no index.html');

  const match = PUBLIC_PATH.exec(window.location.pathname);
  if (match) {
    const kind = match[1] === 'c' ? 'card' : 'profile';
    const raw = match[2] ?? '';
    let id: string;
    try {
      id = decodeURIComponent(raw);
    } catch {
      id = raw;
    }
    mountPublicCard(container, { kind, id });
    return;
  }

  const { renderPanel } = await import('@/app/entry');
  renderPanel(container);
}

void bootstrap();
