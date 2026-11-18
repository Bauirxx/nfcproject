import { HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { enforceRateLimit, FixedWindowRateLimiter } from './rate-limiter';

describe('FixedWindowRateLimiter', () => {
  it('permite até ao limite e bloqueia depois, até a janela recomeçar', () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);
    expect(limiter.hit('ip', 0).allowed).toBe(true);
    expect(limiter.hit('ip', 1_000).allowed).toBe(true);
    expect(limiter.hit('ip', 2_000)).toEqual({ allowed: false, retryAfter: 58 });
    expect(limiter.hit('ip', 60_000).allowed).toBe(true);
  });

  it('conta cada chave em separado', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    expect(limiter.hit('a', 0).allowed).toBe(true);
    expect(limiter.hit('b', 0).allowed).toBe(true);
    expect(limiter.hit('a', 0).allowed).toBe(false);
  });

  it('não cresce além do máximo de chaves', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000, 3);
    for (let i = 0; i < 10; i += 1) limiter.hit(`ip${i}`, 0);
    expect((limiter as unknown as { windows: Map<string, unknown> }).windows.size).toBeLessThanOrEqual(3);
  });
});

describe('enforceRateLimit', () => {
  it('responde 429 rate_limited com Retry-After', () => {
    const limiter = new FixedWindowRateLimiter(0, 60_000);
    const res = { setHeader: vi.fn() } as unknown as Response;
    let error: unknown;
    try {
      enforceRateLimit(limiter, 'ip', res);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toEqual({ error: { code: 'rate_limited' } });
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
});
