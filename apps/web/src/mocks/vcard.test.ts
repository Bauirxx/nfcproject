import { describe, expect, it } from 'vitest';
import { buildVCard, escapeVCardText, foldLine } from './vcard';

const octets = (line: string): number => new TextEncoder().encode(line).length;

describe('escapeVCardText', () => {
  it('escapa barra invertida, vírgula, ponto e vírgula e quebras de linha', () => {
    expect(escapeVCardText('a\\b')).toBe('a\\\\b');
    expect(escapeVCardText('Rua A, 1; Maputo')).toBe('Rua A\\, 1\\; Maputo');
    expect(escapeVCardText('linha 1\nlinha 2\r\nlinha 3\rfim')).toBe('linha 1\\nlinha 2\\nlinha 3\\nfim');
  });

  it('remove caracteres de controlo que permitiriam injetar propriedades', () => {
    expect(escapeVCardText('Nome\u0000\u0007\u001b')).toBe('Nome');
    expect(escapeVCardText('X\nEMAIL:atacante@evil.test')).toBe('X\\nEMAIL:atacante@evil.test');
  });
});

describe('foldLine', () => {
  it('não altera linhas até 75 octetos', () => {
    const line = `FN:${'a'.repeat(72)}`;
    expect(foldLine(line)).toBe(line);
  });

  it('dobra linhas longas com CRLF e espaço, contando octetos e não caracteres', () => {
    const folded = foldLine(`NOTE:${'x'.repeat(150)}`);
    const parts = folded.split('\r\n');
    expect(parts).toHaveLength(3);
    expect(parts[1]?.startsWith(' ')).toBe(true);
    expect(parts.every((part) => octets(part) <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(`NOTE:${'x'.repeat(150)}`);

    const accented = foldLine(`NOTE:${'ã'.repeat(60)}`);
    expect(accented.split('\r\n').every((part) => octets(part) <= 75)).toBe(true);
    expect(accented.replace(/\r\n /g, '')).toBe(`NOTE:${'ã'.repeat(60)}`);
  });
});

describe('buildVCard', () => {
  const vcard = buildVCard({
    displayName: 'Paula Machava',
    title: 'Gestora Comercial',
    company: 'Acme, Lda; Moçambique',
    contacts: [
      { type: 'phone', value: '+258841234567' },
      { type: 'whatsapp', value: '+258841234567' },
      { type: 'whatsapp', value: '+258821112233' },
      { type: 'phone', value: '841234567' },
      { type: 'email', value: 'paula.machava@acme.test' },
      { type: 'website', value: 'https://www.acme.test' },
      { type: 'location', value: 'Av. Julius Nyerere 1234, Maputo' },
    ],
    socialLinks: [{ platform: 'linkedin', url: 'https://www.linkedin.com/in/paula-machava' }],
    cardUrl: 'https://cards.example/c/Zk3vQ9xLr2TnB7wYc1HdMg',
    revision: '2026-11-11T10:20:30.000Z',
  });
  const lines = vcard.split('\r\n');

  it('segue a estrutura do vCard 4.0 com CRLF e sem linhas acima de 75 octetos', () => {
    expect(vcard.endsWith('\r\n')).toBe(true);
    expect(vcard).not.toMatch(/[^\r]\n/);
    expect(lines[0]).toBe('BEGIN:VCARD');
    expect(lines[1]).toBe('VERSION:4.0');
    expect(lines.at(-2)).toBe('END:VCARD');
    expect(lines.every((line) => octets(line) <= 75)).toBe(true);
  });

  it('inclui os campos públicos escapados, sem números repetidos nem inválidos', () => {
    expect(lines).toContain('FN:Paula Machava');
    expect(lines).toContain('N:Machava;Paula;;;');
    expect(lines).toContain('ORG:Acme\\, Lda\\; Moçambique');
    expect(lines).toContain('TITLE:Gestora Comercial');
    expect(lines.filter((line) => line.startsWith('TEL'))).toEqual([
      'TEL;TYPE=cell,voice;VALUE=uri:tel:+258841234567',
      'TEL;TYPE=cell,voice;VALUE=uri:tel:+258821112233',
    ]);
    expect(lines).toContain('EMAIL;TYPE=work:paula.machava@acme.test');
    expect(lines).toContain('URL;TYPE=work:https://www.acme.test');
    expect(lines).toContain('ADR;TYPE=work:;;Av. Julius Nyerere 1234\\, Maputo;;;;');
    expect(lines).toContain('X-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/paula-machava');
    expect(lines).toContain('URL;TYPE=x-nfc-card:https://cards.example/c/Zk3vQ9xLr2TnB7wYc1HdMg');
    expect(lines).toContain('REV:20261111T102030Z');
    expect(lines).not.toContain('TEL;TYPE=cell,voice;VALUE=uri:tel:841234567');
  });

  it('omite cargo e empresa ausentes e trata nomes de uma palavra', () => {
    const minimal = buildVCard({
      displayName: 'Receção',
      title: null,
      company: null,
      contacts: [],
      socialLinks: [],
      cardUrl: 'https://cards.example/c/Ab3_-Ab3_-Ab3_-Ab3_-Ab',
      revision: 'data inválida',
    });
    expect(minimal).toContain('FN:Receção\r\n');
    expect(minimal).toContain('N:;Receção;;;\r\n');
    expect(minimal).not.toContain('ORG:');
    expect(minimal).not.toContain('TITLE:');
    expect(minimal).toContain('REV:19700101T000000Z');
  });

  it('neutraliza tentativas de injetar propriedades pelos dados do perfil', () => {
    const hostile = buildVCard({
      displayName: 'Atacante\r\nEMAIL:x@evil.test',
      title: 'Cargo\nNOTE:injetado',
      company: null,
      contacts: [],
      socialLinks: [],
      cardUrl: 'https://cards.example/c/Ab3_-Ab3_-Ab3_-Ab3_-Ab',
      revision: '2026-01-01T00:00:00.000Z',
    });
    expect(hostile.split('\r\n').filter((line) => line.startsWith('EMAIL:'))).toHaveLength(0);
    expect(hostile.split('\r\n').filter((line) => line.startsWith('NOTE:'))).toHaveLength(0);
    expect(hostile).toContain('FN:Atacante\\nEMAIL:x@evil.test');
  });
});
