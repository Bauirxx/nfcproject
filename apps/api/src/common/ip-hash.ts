// IP guardado apenas como hash com sal diário (CLAUDE.md, regra 6). O sal do dia é um HMAC do segredo com a data,
// por isso os hashes de dias diferentes não se podem cruzar e o IP não se recupera sem o segredo.
import { createHmac, randomBytes } from 'node:crypto';

/** Sal do dia (UTC), derivado do segredo. */
export function dailySalt(secret: string, now: Date = new Date()): Buffer {
  return createHmac('sha256', secret).update(now.toISOString().slice(0, 10)).digest();
}

/** Hash hexadecimal de 64 caracteres do IP com o sal do dia. */
export function hashIp(secret: string, ip: string, now: Date = new Date()): string {
  return createHmac('sha256', dailySalt(secret, now)).update(ip).digest('hex');
}

/** Segredo de desenvolvimento: aleatório por arranque (em produção o IP_HASH_SECRET é obrigatório). */
export function developmentIpSecret(): string {
  return randomBytes(32).toString('hex');
}
