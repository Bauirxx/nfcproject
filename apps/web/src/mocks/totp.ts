// TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, 30 segundos) para a API simulada e para os testes de ponta a ponta.
// Usa a Web Crypto, disponível no browser e no Node. Sem dependências.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Uint8Array<ArrayBuffer> {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of clean) {
    const digit = BASE32_ALPHABET.indexOf(char);
    if (digit < 0) throw new Error('invalid_base32');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes[index] = (value >>> (bits - 8)) & 0xff;
      index += 1;
      bits -= 8;
    }
  }
  return bytes;
}

async function hotp(secret: Uint8Array<ArrayBuffer>, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const message = new Uint8Array(8);
  new DataView(message.buffer).setBigUint64(0, BigInt(counter));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((mac[offset] ?? 0) & 0x7f) << 24) |
    ((mac[offset + 1] ?? 0) << 16) |
    ((mac[offset + 2] ?? 0) << 8) |
    (mac[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, '0');
}

/** Código TOTP de 6 dígitos para o instante dado. */
export function generateTotp(secretBase32: string, timeMs: number = Date.now()): Promise<string> {
  return hotp(base32Decode(secretBase32), Math.floor(timeMs / 1000 / STEP_SECONDS));
}

/** Aceita o código do intervalo atual e dos dois vizinhos, para tolerar relógios ligeiramente diferentes. */
export async function verifyTotp(secretBase32: string, code: string, timeMs: number = Date.now()): Promise<boolean> {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(timeMs / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    if ((await hotp(secret, counter + drift)) === code) return true;
  }
  return false;
}

/** Chave nova de 160 bits, em base32, como as que as aplicações de autenticação esperam. */
export function randomTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}
