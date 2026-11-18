// Limitador de pedidos em memória, por janela fixa (CLAUDE.md, regras 1, 4 e 5).
// Serve uma única instância do backend (plano atual do Render). Com várias instâncias, passa para a base de dados
// ou para um armazenamento partilhado (ADR-0014).
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até a janela recomeçar (para o cabeçalho Retry-After). */
  retryAfter: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Limite de chaves guardadas, para a memória não crescer sem fim sob ataque. */
    private readonly maxKeys = 50_000,
  ) {}

  hit(key: string, now: number = Date.now()): RateLimitResult {
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      if (!window && this.windows.size >= this.maxKeys) this.sweep(now);
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    return {
      allowed: window.count <= this.limit,
      retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  /** Remove as janelas expiradas; se continuar cheio, descarta as mais antigas. */
  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}

/** Aplica o limite e, se excedido, responde 429 `rate_limited` com Retry-After (ADR-0004). */
export function enforceRateLimit(limiter: FixedWindowRateLimiter, key: string, res: Response): void {
  const result = limiter.hit(key);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfter));
    throw new HttpException({ error: { code: 'rate_limited' } }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
