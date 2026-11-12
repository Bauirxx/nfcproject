// Captura do clique nos links do VCF quando a API é simulada. O service worker do MSW não resolve os
// descarregamentos iniciados por `<a download>`, por isso o ficheiro é pedido com `fetch` (que o MSW
// interceta) e entregue ao browser como Blob. Só existe em desenvolvimento e no build de e2e.
const VCF_PATH_PATTERN = /^\/api\/public\/(?:cards|profiles)\/[^/]+\/contact\.vcf$/;
const DEFAULT_FILE_NAME = 'contacto.vcf';

export function isVcfPath(pathname: string): boolean {
  return VCF_PATH_PATTERN.test(pathname);
}

/** O link do VCF (na mesma origem) em que se clicou, ou `null` se o clique foi noutro sítio. */
export function vcfLinkOf(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  const url = new URL(anchor.href, location.origin);
  return url.origin === location.origin && isVcfPath(url.pathname) ? anchor : null;
}

/** Pede o VCF e entrega-o como descarregamento. `false` se a API não o deu (cartão indisponível) ou falhou. */
export async function downloadVcf(pathname: string, fallbackName: string = DEFAULT_FILE_NAME): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(pathname, { credentials: 'include' });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  const blob = await response.blob();
  const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return true;
}

export interface InterceptOptions {
  /** Recebe cada descarregamento iniciado; serve aos testes para esperar por ele. */
  onDownload?: (download: Promise<boolean>) => void;
}

/** Liga a captura ao documento e devolve a função que a desliga. Cliques modificados (nova aba) não são tocados. */
export function interceptVcfDownloads(root: Document = document, options: InterceptOptions = {}): () => void {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const anchor = vcfLinkOf(event.target);
    if (!anchor) return;
    event.preventDefault();
    const download = downloadVcf(new URL(anchor.href, location.origin).pathname, anchor.download || DEFAULT_FILE_NAME);
    options.onDownload?.(download);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
