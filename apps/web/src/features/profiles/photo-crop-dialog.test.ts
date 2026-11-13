import { describe, expect, it } from 'vitest';
import { computeCropSource } from './photo-crop-dialog';

describe('computeCropSource', () => {
  it('recorta o maior quadrado centrado sem zoom nem deslocamento', () => {
    expect(computeCropSource(800, 600, 1, 0, 0)).toEqual({ sx: 100, sy: 0, side: 600 });
    expect(computeCropSource(400, 1000, 1, 0, 0)).toEqual({ sx: 0, sy: 300, side: 400 });
  });

  it('o zoom reduz o lado do recorte', () => {
    const result = computeCropSource(600, 600, 2, 0, 0);
    expect(result.side).toBe(300);
    // Continua centrado: sobra 300 px em cada eixo, metade de cada lado.
    expect(result.sx).toBe(150);
    expect(result.sy).toBe(150);
  });

  it('o deslocamento move o recorte dentro da imagem e fica preso aos limites', () => {
    const quad = computeCropSource(800, 600, 1, 1, 0);
    expect(quad.sx).toBe(200); // totalmente à direita: (800-600)
    expect(computeCropSource(800, 600, 1, -1, 0).sx).toBe(0); // totalmente à esquerda
    // Valores fora de [-1, 1] são presos.
    expect(computeCropSource(800, 600, 1, 5, 0).sx).toBe(200);
  });
});
