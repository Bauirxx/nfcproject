import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './constants';
import {
  CONTRAST_AA_LARGE,
  CONTRAST_AA_TEXT,
  contrastRatio,
  meetsContrast,
  parseHexColor,
  readableTextOn,
} from './contrast';

describe('parseHexColor', () => {
  it('converte #rrggbb em componentes', () => {
    expect(parseHexColor('#1e40af')).toEqual([30, 64, 175]);
    expect(parseHexColor('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('devolve null para valores inválidos', () => {
    expect(parseHexColor('#fff')).toBeNull();
    expect(parseHexColor('azul')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('vai de 1 (cores iguais) a 21 (preto sobre branco)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('coincide com os valores de referência das WCAG', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('devolve null se alguma cor for inválida', () => {
    expect(contrastRatio('#12', '#ffffff')).toBeNull();
  });
});

describe('meetsContrast', () => {
  it('aplica o limite AA de texto por defeito', () => {
    expect(meetsContrast('#767676', '#ffffff')).toBe(true);
    expect(meetsContrast('#777777', '#ffffff')).toBe(false);
  });

  it('aceita o limite de texto grande e componentes', () => {
    expect(meetsContrast('#777777', '#ffffff', CONTRAST_AA_LARGE)).toBe(true);
    expect(meetsContrast('#cccccc', '#ffffff', CONTRAST_AA_LARGE)).toBe(false);
  });

  it('o tema por defeito cumpre AA', () => {
    expect(meetsContrast(DEFAULT_THEME.textColor, DEFAULT_THEME.backgroundColor, CONTRAST_AA_TEXT)).toBe(true);
    expect(meetsContrast(DEFAULT_THEME.primaryColor, DEFAULT_THEME.backgroundColor, CONTRAST_AA_TEXT)).toBe(true);
  });
});

describe('readableTextOn', () => {
  it('escolhe branco sobre fundos escuros e preto sobre fundos claros', () => {
    expect(readableTextOn('#1e40af')).toBe('#ffffff');
    expect(readableTextOn('#facc15')).toBe('#000000');
    expect(readableTextOn('#ffffff')).toBe('#000000');
  });

  it('o texto escolhido cumpre sempre AA sobre o fundo', () => {
    for (const background of ['#1e40af', '#facc15', '#808080', '#b91c1c', '#15803d']) {
      expect(meetsContrast(readableTextOn(background), background)).toBe(true);
    }
  });
});
