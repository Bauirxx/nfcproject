import { describe, expect, it } from 'vitest';
import { lineGeometry } from './chart-geometry';

const pad = { top: 10, right: 10, bottom: 20, left: 10 };

describe('lineGeometry', () => {
  it('escala os valores para a caixa, com a base no máximo', () => {
    const geo = lineGeometry([0, 5, 10], 110, 130, pad);
    expect(geo.max).toBe(10);
    // 3 pontos: esquerda, meio, direita (largura interna 90).
    expect(geo.points.map((p) => p.x)).toEqual([10, 55, 100]);
    // valor 0 na base (y=110), valor 10 no topo (y=10).
    expect(geo.points[0]?.y).toBe(110);
    expect(geo.points[2]?.y).toBe(10);
    expect(geo.line.startsWith('M10 110 L55')).toBe(true);
    expect(geo.area.endsWith('Z')).toBe(true);
  });

  it('usa um máximo mínimo de 1 quando tudo é zero', () => {
    const geo = lineGeometry([0, 0], 110, 130, pad);
    expect(geo.max).toBe(1);
    expect(geo.points.every((p) => p.y === 110)).toBe(true);
  });

  it('centra um único ponto', () => {
    const geo = lineGeometry([4], 110, 130, pad);
    expect(geo.points).toEqual([{ x: 55, y: 10 }]);
  });

  it('devolve caminhos vazios sem dados', () => {
    expect(lineGeometry([], 110, 130, pad)).toMatchObject({ line: '', area: '' });
  });
});
