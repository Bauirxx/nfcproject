import { describe, expect, it } from 'vitest';
import {
  buildCardUrl,
  buildMailtoUrl,
  buildMapsUrl,
  buildProfileUrl,
  buildShareMessage,
  buildSmsUrl,
  buildTelUrl,
  buildWhatsAppUrl,
  formatPhoneDisplay,
  maskEmail,
  maskPhone,
  maskRecipient,
  toSafeHttpsUrl,
  toSafeImageUrl,
} from './links';

const TOKEN = 'Ab3_-Ab3_-Ab3_-Ab3_-Ab';

describe('links do cartão', () => {
  it('constrói o URL do chip a partir de um token válido', () => {
    expect(buildCardUrl('https://nfc.test', TOKEN)).toBe(`https://nfc.test/c/${TOKEN}`);
    expect(buildCardUrl('https://nfc.test', '../../etc')).toBeNull();
  });

  it('constrói o URL do perfil a partir de um slug válido', () => {
    expect(buildProfileUrl('https://nfc.test', 'ana-silva')).toBe('https://nfc.test/p/ana-silva');
    expect(buildProfileUrl('https://nfc.test', 'Ana Silva')).toBeNull();
  });
});

describe('links externos', () => {
  it('só devolve URLs https', () => {
    expect(toSafeHttpsUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(toSafeHttpsUrl('http://example.com/a')).toBeNull();
    expect(toSafeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeHttpsUrl(null)).toBeNull();
    expect(toSafeHttpsUrl('')).toBeNull();
  });

  it('nas imagens aceita https, mesma origem, blob: e data: raster', () => {
    expect(toSafeImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(toSafeImageUrl('/api/files/abc')).toBe('/api/files/abc');
    expect(toSafeImageUrl('blob:https://nfc.test/1234')).toBe('blob:https://nfc.test/1234');
    expect(toSafeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('nas imagens rejeita SVG, outros esquemas e URLs relativos ao protocolo', () => {
    expect(toSafeImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(toSafeImageUrl('data:text/html;base64,PGI+')).toBeNull();
    expect(toSafeImageUrl('//evil.test/a.png')).toBeNull();
    expect(toSafeImageUrl('http://example.com/a.png')).toBeNull();
    expect(toSafeImageUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeImageUrl(undefined)).toBeNull();
  });
});

describe('links de contacto', () => {
  it('tel: exige E.164', () => {
    expect(buildTelUrl('+258841234567')).toBe('tel:+258841234567');
    expect(buildTelUrl('841234567')).toBeNull();
  });

  it('wa.me é construído a partir de E.164 e codifica o texto', () => {
    expect(buildWhatsAppUrl('+258841234567')).toBe('https://wa.me/258841234567');
    expect(buildWhatsAppUrl('+258841234567', 'Olá & adeus')).toBe(
      'https://wa.me/258841234567?text=Ol%C3%A1%20%26%20adeus',
    );
    expect(buildWhatsAppUrl('258841234567')).toBeNull();
    expect(buildWhatsAppUrl('+258841234567/../x')).toBeNull();
  });

  it('sms: é construído a partir de E.164 e codifica o corpo', () => {
    expect(buildSmsUrl('+258841234567')).toBe('sms:+258841234567');
    expect(buildSmsUrl('+258841234567', 'Olá\nmundo')).toBe('sms:+258841234567?&body=Ol%C3%A1%0Amundo');
    expect(buildSmsUrl('84 123 4567')).toBeNull();
  });

  it('mailto: exige um email válido', () => {
    expect(buildMailtoUrl('ana@acme.test')).toBe('mailto:ana@acme.test');
    expect(buildMailtoUrl('ana+cartao@acme.test')).toBe('mailto:ana%2Bcartao@acme.test');
    expect(buildMailtoUrl('ana@acme.test?bcc=x@evil.test')).toBeNull();
  });

  it('a localização abre uma pesquisa de mapa em https', () => {
    expect(buildMapsUrl('Av. 25 de Setembro, Maputo')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%2025%20de%20Setembro%2C%20Maputo',
    );
    expect(buildMapsUrl('   ')).toBeNull();
  });
});

describe('apresentação de números', () => {
  it('agrupa números de Moçambique', () => {
    expect(formatPhoneDisplay('+258841234567')).toBe('+258 84 123 4567');
  });

  it('agrupa outros indicativos de três em três e não toca em valores inválidos', () => {
    expect(formatPhoneDisplay('+351912345678')).toBe('+351 912 345 678');
    expect(formatPhoneDisplay('84123')).toBe('84123');
  });
});

describe('mascarar destinatários', () => {
  it('mascara emails', () => {
    expect(maskEmail('joao.silva@empresa.co.mz')).toBe('j•••@e•••.mz');
    expect(maskEmail('semarroba')).toBe('•••');
  });

  it('mascara telefones', () => {
    expect(maskPhone('+258841234567')).toBe('+258 ••• •• 567');
    expect(maskPhone('841234567')).toBe('•••');
  });

  it('escolhe o campo disponível e nunca devolve o valor original', () => {
    expect(maskRecipient({ email: 'ana@acme.test' })).toBe('a•••@a•••.test');
    expect(maskRecipient({ phone: '+258841234567' })).toBe('+258 ••• •• 567');
    expect(maskRecipient({})).toBe('•••');
  });
});

describe('buildShareMessage', () => {
  it('inclui saudação, remetente e link', () => {
    expect(buildShareMessage({ senderName: 'Paula Owner', cardUrl: `https://nfc.test/c/${TOKEN}` })).toBe(
      `Olá,\nPaula Owner partilhou consigo o seu cartão de visita digital:\nhttps://nfc.test/c/${TOKEN}`,
    );
  });

  it('usa o nome do destinatário e acrescenta a nota', () => {
    expect(
      buildShareMessage({
        senderName: 'Paula Owner',
        recipientName: '  João ',
        cardUrl: 'https://nfc.test/c/x',
        note: ' Até breve. ',
      }),
    ).toBe('Olá João,\nPaula Owner partilhou consigo o seu cartão de visita digital:\nhttps://nfc.test/c/x\n\nAté breve.');
  });

  it('ignora nome e nota vazios', () => {
    const message = buildShareMessage({ senderName: 'Paula', recipientName: '  ', cardUrl: 'https://x.test/c/y', note: '' });
    expect(message.startsWith('Olá,\n')).toBe(true);
    expect(message.endsWith('https://x.test/c/y')).toBe(true);
  });
});
