// Arranque da API simulada no browser (desenvolvimento e build de e2e). Só é importado, com import dinâmico,
// quando `__API_MOCKING__` é verdadeiro; o `define` do Vite elimina esse ramo do build de produção.
import { setupWorker } from 'msw/browser';
import { enablePersistence } from './db';
import { handlers } from './handlers';
import { interceptVcfDownloads } from './vcf-download';

/** Regista o service worker do MSW, liga a persistência dos dados fictícios e a captura dos descarregamentos do VCF. */
export async function startMockApi(): Promise<void> {
  // Os dados sobrevivem a recarregamentos e são partilhados entre separadores (só dados fictícios).
  enablePersistence();
  const worker = setupWorker(...handlers);
  await worker.start({
    // Todos os pedidos /api/* têm handler (o último responde 404); os restantes, como ficheiros estáticos, passam.
    onUnhandledFrame: 'bypass',
    // Sem registo dos pedidos na consola: o separador Network do browser mostra o mesmo.
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  interceptVcfDownloads();
}
