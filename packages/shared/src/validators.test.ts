import { describe, expect, it } from 'vitest';
import {
  containsHtml,
  containsLink,
  isAllowedSocialUrl,
  isCardToken,
  isE164,
  isEmail,
  isHexColor,
  isHttpsUrl,
  isMultilineText,
  isSingleLineText,
  isSlug,
  isValidNote,
  normalizePhone,
} from './validators';

describe('isE164', () => {
  it('aceita números com indicativo', () => {
    expect(isE164('+258841234567')).toBe(true);
    expect(isE164('+351912345678')).toBe(true);
  });

  it('rejeita números sem +, curtos, longos ou com outros caracteres', () => {
    expect(isE164('258841234567')).toBe(false);
    expect(isE164('+0841234567')).toBe(false);
    expect(isE164('+2588412')).toBe(false);
    expect(isE164('+2588412345678901')).toBe(false);
    expect(isE164('+258 84 123 4567')).toBe(false);
    expect(isE164('+258841234567?text=x')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('assume +258 quando não há indicativo', () => {
    expect(normalizePhone('84 123 4567')).toBe('+258841234567');
    expect(normalizePhone('0841234567')).toBe('+258841234567');
    expect(normalizePhone('(84) 123-4567')).toBe('+258841234567');
  });

  it('respeita o indicativo escrito pelo utilizador', () => {
    expect(normalizePhone('+351 912 345 678')).toBe('+351912345678');
    expect(normalizePhone('00258841234567')).toBe('+258841234567');
    expect(normalizePhone('258841234567')).toBe('+258841234567');
  });

  it('aceita outro indicativo por defeito', () => {
    expect(normalizePhone('912345678', '+351')).toBe('+351912345678');
  });

  it('devolve null para valores inválidos', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('84 123 4567 ; rm -rf')).toBeNull();
  });
});

describe('isEmail', () => {
  it('aceita endereços comuns', () => {
    expect(isEmail('ana@acme.test')).toBe(true);
    expect(isEmail('joao.silva+cartao@empresa.co.mz')).toBe(true);
  });

  it('rejeita endereços malformados ou com caracteres perigosos num mailto:', () => {
    expect(isEmail('ana@acme')).toBe(false);
    expect(isEmail('@acme.test')).toBe(false);
    expect(isEmail('ana..silva@acme.test')).toBe(false);
    expect(isEmail('ana.@acme.test')).toBe(false);
    expect(isEmail('ana silva@acme.test')).toBe(false);
    expect(isEmail('ana?subject=x@acme.test')).toBe(false);
    expect(isEmail(`${'a'.repeat(65)}@acme.test`)).toBe(false);
    expect(isEmail(`ana@${'a'.repeat(250)}.test`)).toBe(false);
  });
});

describe('isHttpsUrl', () => {
  it('só aceita https absoluto com domínio', () => {
    expect(isHttpsUrl('https://example.com/caminho?x=1')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('//example.com')).toBe(false);
    expect(isHttpsUrl('example.com')).toBe(false);
    expect(isHttpsUrl('https://localhost')).toBe(false);
  });

  it('rejeita esquemas perigosos, credenciais e caracteres proibidos', () => {
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isHttpsUrl('https://user:pass@example.com')).toBe(false);
    expect(isHttpsUrl('https://exa mple.com')).toBe(false);
    expect(isHttpsUrl('https://example.com/"><script>')).toBe(false);
    expect(isHttpsUrl(`https://example.com/${'a'.repeat(2100)}`)).toBe(false);
  });
});

describe('isAllowedSocialUrl', () => {
  it('aceita o domínio da rede e os seus subdomínios', () => {
    expect(isAllowedSocialUrl('linkedin', 'https://www.linkedin.com/in/ana')).toBe(true);
    expect(isAllowedSocialUrl('linkedin', 'https://linkedin.com/in/ana')).toBe(true);
    expect(isAllowedSocialUrl('x', 'https://twitter.com/ana')).toBe(true);
    expect(isAllowedSocialUrl('telegram', 'https://t.me/ana')).toBe(true);
  });

  it('rejeita outros domínios, domínios parecidos e http', () => {
    expect(isAllowedSocialUrl('linkedin', 'https://linkedin.com.evil.test/in/ana')).toBe(false);
    expect(isAllowedSocialUrl('linkedin', 'https://evil-linkedin.com/in/ana')).toBe(false);
    expect(isAllowedSocialUrl('linkedin', 'https://facebook.com/ana')).toBe(false);
    expect(isAllowedSocialUrl('linkedin', 'http://www.linkedin.com/in/ana')).toBe(false);
  });
});

describe('isCardToken e isSlug', () => {
  it('o token tem exatamente 22 caracteres base64url', () => {
    expect(isCardToken('Ab3_-Ab3_-Ab3_-Ab3_-Ab')).toBe(true);
    expect(isCardToken('A'.repeat(21))).toBe(false);
    expect(isCardToken('A'.repeat(23))).toBe(false);
    expect(isCardToken(`${'A'.repeat(21)}+`)).toBe(false);
    expect(isCardToken(`${'A'.repeat(20)}/.`)).toBe(false);
  });

  it('o slug tem 3 a 50 caracteres minúsculos, dígitos e hífenes', () => {
    expect(isSlug('ana-silva')).toBe(true);
    expect(isSlug('ab')).toBe(false);
    expect(isSlug('-ana')).toBe(false);
    expect(isSlug('Ana-Silva')).toBe(false);
    expect(isSlug('ana/silva')).toBe(false);
  });
});

describe('isHexColor', () => {
  it('só aceita #rrggbb', () => {
    expect(isHexColor('#1e40af')).toBe(true);
    expect(isHexColor('#1E40AF')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('1e40af')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#1e40af;background:url(x)')).toBe(false);
  });
});

describe('texto simples', () => {
  it('deteta links', () => {
    expect(containsLink('veja http://example.com')).toBe(true);
    expect(containsLink('veja www.example')).toBe(true);
    expect(containsLink('veja example.com agora')).toBe(true);
    expect(containsLink('Olá, tudo bem? Reunião às 10.30.')).toBe(false);
  });

  it('deteta HTML', () => {
    expect(containsHtml('<b>olá</b>')).toBe(true);
    expect(containsHtml('2 > 1')).toBe(true);
    expect(containsHtml('olá')).toBe(false);
  });

  it('distingue texto de uma linha de texto com quebras', () => {
    expect(isSingleLineText('Ana Silva')).toBe(true);
    expect(isSingleLineText('Ana\nSilva')).toBe(false);
    expect(isMultilineText('linha 1\nlinha 2')).toBe(true);
    expect(isMultilineText('linha\u0000')).toBe(false);
  });
});

describe('isValidNote', () => {
  it('aceita texto simples até 200 caracteres', () => {
    expect(isValidNote('Foi um prazer conhecê-lo.\nAté breve!')).toBe(true);
    expect(isValidNote('a'.repeat(200))).toBe(true);
    expect(isValidNote('')).toBe(true);
  });

  it('rejeita notas longas, com links ou com HTML', () => {
    expect(isValidNote('a'.repeat(201))).toBe(false);
    expect(isValidNote('veja https://example.com')).toBe(false);
    expect(isValidNote('veja example.com')).toBe(false);
    expect(isValidNote('<a href="x">x</a>')).toBe(false);
    expect(isValidNote('texto\u0007')).toBe(false);
  });
});
