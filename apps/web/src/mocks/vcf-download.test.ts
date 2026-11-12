import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_TOKENS } from './credentials';
import { downloadVcf, interceptVcfDownloads, isVcfPath, vcfLinkOf } from './vcf-download';

const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:nfc-business/vcf');
const revokeObjectURL = vi.fn<(url: string) => void>();
let anchorClicks: string[] = [];

beforeEach(() => {
  // O jsdom não implementa URLs de Blob nem descarregamentos. (Os spies são repostos antes de cada teste
  // pela opção `restoreMocks`, por isso ficam aqui e não em `beforeAll`.)
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchorClicks.push(`${this.download}|${this.href}`);
  });
});

afterEach(() => {
  anchorClicks = [];
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  document.body.replaceChildren();
});

function addLink(href: string, download: string = ''): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = download;
  anchor.append(document.createElement('span'));
  document.body.append(anchor);
  return anchor;
}

function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('isVcfPath e vcfLinkOf', () => {
  it('só reconhece os caminhos do VCF na mesma origem', () => {
    expect(isVcfPath('/api/public/cards/Zk3vQ9xLr2TnB7wYc1HdMg/contact.vcf')).toBe(true);
    expect(isVcfPath('/api/public/profiles/paula-machava/contact.vcf')).toBe(true);
    expect(isVcfPath('/api/public/cards/Zk3vQ9xLr2TnB7wYc1HdMg')).toBe(false);
    expect(isVcfPath('/api/public/cards/../../auth/session/contact.vcf')).toBe(false);
    expect(isVcfPath('/contact.vcf')).toBe(false);

    const vcf = addLink(`/api/public/cards/${MOCK_TOKENS.activeCard}/contact.vcf`);
    const other = addLink('/c/abc');
    const external = addLink('https://evil.test/api/public/cards/x/contact.vcf');
    expect(vcfLinkOf(vcf.firstElementChild)).toBe(vcf);
    expect(vcfLinkOf(other)).toBeNull();
    expect(vcfLinkOf(external)).toBeNull();
    expect(vcfLinkOf(document.body)).toBeNull();
    expect(vcfLinkOf(null)).toBeNull();
  });
});

describe('downloadVcf', () => {
  it('pede o ficheiro à API simulada e entrega-o com o nome do cabeçalho', async () => {
    await expect(downloadVcf(`/api/public/cards/${MOCK_TOKENS.activeCard}/contact.vcf`)).resolves.toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('text/vcard;charset=utf-8');
    expect(await blob?.text()).toContain('FN:Paula Machava');
    expect(anchorClicks).toEqual(['paula-machava.vcf|blob:nfc-business/vcf']);
    expect(document.body.querySelector('a')).toBeNull();
  });

  it('não descarrega nada quando o cartão não está disponível', async () => {
    await expect(downloadVcf(`/api/public/cards/${MOCK_TOKENS.blockedCard}/contact.vcf`)).resolves.toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchorClicks).toEqual([]);
  });
});

describe('interceptVcfDownloads', () => {
  it('captura o clique no link do VCF, impede a navegação e descarrega o ficheiro', async () => {
    const downloads: Array<Promise<boolean>> = [];
    const stop = interceptVcfDownloads(document, { onDownload: (download) => downloads.push(download) });
    const link = addLink(`/api/public/profiles/${MOCK_TOKENS.ownerSlug}/contact.vcf`, 'o-meu-contacto.vcf');
    const event = click(link.firstElementChild ?? link);
    stop();
    expect(event.defaultPrevented).toBe(true);
    expect(downloads).toHaveLength(1);
    await expect(downloads[0]).resolves.toBe(true);
    expect(anchorClicks).toEqual(['paula-machava.vcf|blob:nfc-business/vcf']);
  });

  it('deixa passar cliques noutros links, com modificadores ou já tratados, e desliga-se', () => {
    const downloads: Array<Promise<boolean>> = [];
    const stop = interceptVcfDownloads(document, { onDownload: (download) => downloads.push(download) });
    const vcf = addLink(`/api/public/cards/${MOCK_TOKENS.activeCard}/contact.vcf`);
    const other = addLink('/c/abc');
    // Evita a navegação do jsdom nos cliques que a captura não trata.
    document.addEventListener('click', (event) => event.preventDefault());

    expect(click(other).defaultPrevented).toBe(true);
    click(vcf, { ctrlKey: true });
    click(vcf, { metaKey: true });
    click(vcf, { button: 1 });
    stop();
    click(vcf);
    expect(downloads).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchorClicks).toEqual([]);
  });
});
