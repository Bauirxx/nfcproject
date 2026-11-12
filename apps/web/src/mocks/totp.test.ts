import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotp, randomTotpSecret, verifyTotp } from './totp';

// Chave dos vetores de teste da RFC 6238 (SHA-1): os bytes ASCII de «12345678901234567890».
const RFC_SECRET = base32Encode(new TextEncoder().encode('12345678901234567890'));

describe('TOTP da API simulada', () => {
  it('codifica e descodifica base32', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(new TextDecoder().decode(base32Decode(RFC_SECRET))).toBe('12345678901234567890');
    expect(() => base32Decode('não é base32!')).toThrow('invalid_base32');
  });

  it.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
  ])('gera o código da RFC 6238 para t=%i', async (seconds, expected) => {
    await expect(generateTotp(RFC_SECRET, seconds * 1000)).resolves.toBe(expected);
  });

  it('aceita o intervalo atual e os vizinhos, e recusa os restantes', async () => {
    const now = 1_700_000_000_000;
    const code = await generateTotp(RFC_SECRET, now);

    await expect(verifyTotp(RFC_SECRET, code, now)).resolves.toBe(true);
    await expect(verifyTotp(RFC_SECRET, code, now + 30_000)).resolves.toBe(true);
    await expect(verifyTotp(RFC_SECRET, code, now - 30_000)).resolves.toBe(true);
    await expect(verifyTotp(RFC_SECRET, code, now + 120_000)).resolves.toBe(false);
    await expect(verifyTotp(RFC_SECRET, '000000', now)).resolves.toBe(false);
  });

  it('gera chaves novas de 160 bits', () => {
    const secret = randomTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(randomTotpSecret()).not.toBe(secret);
  });
});
