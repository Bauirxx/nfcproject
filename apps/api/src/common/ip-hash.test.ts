import { describe, expect, it } from 'vitest';
import { developmentIpSecret, hashIp } from './ip-hash';

const secret = 'x'.repeat(32);

describe('hashIp', () => {
  it('produz 64 caracteres hexadecimais e não contém o IP', () => {
    const hash = hashIp(secret, '197.218.1.10', new Date('2026-11-18T10:00:00Z'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('197');
  });

  it('é estável no mesmo dia e muda de dia para dia (sal diário)', () => {
    const morning = hashIp(secret, '197.218.1.10', new Date('2026-11-18T01:00:00Z'));
    const evening = hashIp(secret, '197.218.1.10', new Date('2026-11-18T23:00:00Z'));
    const tomorrow = hashIp(secret, '197.218.1.10', new Date('2026-11-19T01:00:00Z'));
    expect(morning).toBe(evening);
    expect(tomorrow).not.toBe(morning);
  });

  it('depende do segredo', () => {
    const day = new Date('2026-11-18T10:00:00Z');
    expect(hashIp(secret, '1.1.1.1', day)).not.toBe(hashIp('y'.repeat(32), '1.1.1.1', day));
  });

  it('o segredo de desenvolvimento é aleatório', () => {
    expect(developmentIpSecret()).toMatch(/^[0-9a-f]{64}$/);
    expect(developmentIpSecret()).not.toBe(developmentIpSecret());
  });
});
