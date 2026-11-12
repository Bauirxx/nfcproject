import { describe, expect, it } from 'vitest';
import { qrSvgMarkup } from './qr';

describe('qrSvgMarkup', () => {
  it('gera um SVG completo com módulos', () => {
    const svg = qrSvgMarkup('https://exemplo.test/c/Zk3vQ9xLr2TnB7wYc1HdMg');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('usa um viewBox quadrado e aplica a escala à dimensão', () => {
    const svg = qrSvgMarkup('teste', { scale: 4, margin: 1 });
    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    const size = /width="(\d+)"/.exec(svg);
    expect(viewBox?.[1]).toBe(viewBox?.[2]);
    expect(Number(size?.[1])).toBe(Number(viewBox?.[1]) * 4);
  });
});
