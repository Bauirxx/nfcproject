// Ponto de entrada. A página pública (/c/:token, /p/:slug) será carregada estaticamente aqui na T-FE-10;
// por agora todos os caminhos abrem o painel, carregado por `import()` dinâmico (ADR-0003).
// Só `import()` dinâmico sai do orçamento da página pública; nada pesado é importado estaticamente.
import './styles/index.css';

async function bootstrap(): Promise<void> {
  // Em desenvolvimento e e2e, a API é simulada com MSW antes de a aplicação arrancar (ADR-0009).
  if (__API_MOCKING__) {
    const { startMockApi } = await import('@/mocks/browser');
    await startMockApi();
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Elemento #root em falta no index.html');

  const { renderPanel } = await import('@/app/entry');
  renderPanel(container);
}

void bootstrap();
