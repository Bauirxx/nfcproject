// Verificação de palavras-passe vazadas (CLAUDE.md, regra 1) pela API "range" do Have I Been Pwned, por
// k-anonimato: só os 5 primeiros caracteres do SHA-1 saem do servidor; a palavra-passe e o hash completo nunca.
import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const logger = new Logger('BreachedPassword');

export type Fetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  ok: boolean;
  text(): Promise<string>;
}>;

/**
 * `true` se a palavra-passe aparece em fugas conhecidas. Se o serviço não responder, deixa passar (disponibilidade)
 * e regista o aviso: o comprimento mínimo de 12 caracteres continua a aplicar-se.
 */
export async function isBreachedPassword(password: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<boolean> {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetcher(`${RANGE_URL}${prefix}`, {
      // Add-Padding: a resposta tem sempre um tamanho parecido, para não revelar nada pelo tamanho.
      headers: { 'Add-Padding': 'true', 'User-Agent': 'nfc-business-api' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('resposta inválida');
    const body = await response.text();
    return body.split('\n').some((line) => {
      const [candidate, count] = line.trim().split(':');
      return candidate === suffix && Number(count) > 0;
    });
  } catch (error) {
    logger.warn(`Verificação de palavra-passe vazada indisponível: ${error instanceof Error ? error.message : 'erro'}`);
    return false;
  }
}
