import { HttpException, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../config/env';
import type { PublicCardService, PublicTarget } from './public-card.service';
import { PUBLIC_RATE_LIMIT, PublicController } from './public.controller';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const target: PublicTarget = {
  cardId: 'c_1',
  token: TOKEN,
  companyId: 'co_acme',
  profileId: 'p_1',
  slug: 'paula-machava',
  card: {
    profileId: 'p_1',
    displayName: 'Paula Machava',
    title: null,
    company: null,
    bio: null,
    photoUrl: null,
    contacts: [],
    socialLinks: [],
    theme: { template: 'classic', primaryColor: '#1e40af', backgroundColor: '#ffffff', textColor: '#0f172a', logoUrl: null },
  },
};

function setup(found: PublicTarget | null = target) {
  const cards = {
    find: vi.fn(async () => found),
    buildVcf: vi.fn(() => 'BEGIN:VCARD\r\nEND:VCARD\r\n'),
    recordEvent: vi.fn(async () => undefined),
  };
  const env = loadEnv({ IP_HASH_SECRET: 's'.repeat(32), PUBLIC_APP_URL: 'https://app.exemplo.com' });
  const controller = new PublicController(cards as unknown as PublicCardService, env);
  const headers = new Map<string, string>();
  const res = { setHeader: vi.fn((name: string, value: string) => headers.set(name, value)) } as unknown as Response;
  const req = (ip = '197.218.1.10') => ({ ip }) as unknown as Request;
  return { controller, cards, res, req, headers };
}

describe('PublicController', () => {
  it('devolve o cartão público com cache de 60 s e noindex', async () => {
    const { controller, res, req, headers } = setup();
    expect(await controller.cardByToken(TOKEN, req(), res)).toEqual(target.card);
    expect(headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('cartão inexistente, inativo ou bloqueado: 404 neutro sem cache', async () => {
    const { controller, res, req, headers } = setup(null);
    await expect(controller.cardBySlug('qualquer-um', req(), res)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.vcfByToken(TOKEN, req(), res)).rejects.toMatchObject({
      response: { error: { code: 'not_found' } },
    });
    expect(headers.get('Cache-Control')).toBe('no-store');
  });

  it('serve o VCF como anexo, com a origem pública', async () => {
    const { controller, cards, res, req, headers } = setup();
    await controller.vcfBySlug('paula-machava', req(), res);
    expect(headers.get('Content-Type')).toBe('text/vcard; charset=utf-8');
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="paula-machava.vcf"');
    expect(cards.buildVcf).toHaveBeenCalledWith(target, 'https://app.exemplo.com');
  });

  it(`limita a ${PUBLIC_RATE_LIMIT} pedidos por minuto por IP`, async () => {
    const { controller, res, req } = setup();
    for (let i = 0; i < PUBLIC_RATE_LIMIT; i += 1) await controller.cardByToken(TOKEN, req(), res);
    const blocked = controller.cardByToken(TOKEN, req(), res);
    await expect(blocked).rejects.toBeInstanceOf(HttpException);
    await expect(blocked).rejects.toMatchObject({ status: 429 });
    // Outro IP não é afetado.
    await expect(controller.cardByToken(TOKEN, req('41.220.0.1'), res)).resolves.toEqual(target.card);
  });

  it('regista o evento com o hash do IP (nunca o IP)', async () => {
    const { controller, cards, res, req } = setup();
    await controller.event({ type: 'view', token: TOKEN }, req(), res);
    expect(cards.recordEvent).toHaveBeenCalledWith(target, 'view', expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(JSON.stringify(cards.recordEvent.mock.calls)).not.toContain('197.218');
  });

  it('evento para cartão inexistente: 204 sem registo (não revela nada)', async () => {
    const { controller, cards, res, req } = setup(null);
    await expect(controller.event({ type: 'vcf_download', slug: 'ninguem' }, req(), res)).resolves.toBeUndefined();
    expect(cards.recordEvent).not.toHaveBeenCalled();
  });
});
