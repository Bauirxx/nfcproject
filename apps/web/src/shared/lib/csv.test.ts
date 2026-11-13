import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvCell } from './csv';

describe('escapeCsvCell', () => {
  it('neutraliza fórmulas com uma plica inicial', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('+SOMA(A1)')).toBe("'+SOMA(A1)");
    expect(escapeCsvCell('-2')).toBe("'-2");
    expect(escapeCsvCell('@x')).toBe("'@x");
    expect(escapeCsvCell('\tTAB')).toBe("'\tTAB");
  });

  it('não toca em texto e números normais', () => {
    expect(escapeCsvCell('Acme')).toBe('Acme');
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell('ana@acme.test')).toBe('ana@acme.test');
  });

  it('cita células com vírgula, aspas ou quebra de linha (RFC 4180)', () => {
    expect(escapeCsvCell('Acme, Lda.')).toBe('"Acme, Lda."');
    expect(escapeCsvCell('diz "olá"')).toBe('"diz ""olá"""');
    expect(escapeCsvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('neutraliza e cita quando precisa de ambos', () => {
    expect(escapeCsvCell('=1,2')).toBe('"\'=1,2"');
  });
});

describe('buildCsv', () => {
  it('monta o cabeçalho e as linhas separados por CRLF', () => {
    const csv = buildCsv(['Cartão', 'Visitas'], [['Paula', 10], ['Receção', 3]]);
    expect(csv).toBe('Cartão,Visitas\r\nPaula,10\r\nReceção,3');
  });
});
