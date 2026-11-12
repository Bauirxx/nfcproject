import type { PublicCard } from '@nfc-business/shared/schemas';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '../credentials';
import { getDb } from '../db';
import { civilDate, counterKey } from '../domain';
import { publicHandlers } from './public';
import { api, readJson, useMockServer } from './testing';

useMockServer(publicHandlers);

const ACTIVE = MOCK_TOKENS.activeCard;

function tokenOf(cardId: string): string {
  const card = getDb().cards.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error(`cartão de teste em falta: ${cardId}`);
  return card.token;
}

async function publicCard(path: string): Promise<Response> {
  return api('GET', path);
}

async function event(body: unknown, csrf: boolean = true): Promise<Response> {
  return api('POST', '/api/public/events', body, { csrf });
}

function counter(cardId: string, metric: 'views' | 'clicks' | 'vcfDownloads' | 'contactsSent'): number {
  return getDb().counters[counterKey(cardId, civilDate(), metric)] ?? 0;
}

describe('GET /api/public/cards/:token', () => {
  it('devolve só os campos públicos de um cartão ativo, com cache de 60 segundos', async () => {
    const response = await publicCard(`/api/public/cards/${ACTIVE}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    const body = await readJson<PublicCard>(response);
    expect(body).toMatchObject({
      profileId: 'p_paula',
      displayName: 'Paula Machava',
      title: 'Gestora Comercial',
      company: 'Acme Moçambique',
      photoUrl: null,
      theme: { template: 'classic' },
    });
    expect(body.contacts.map((contact) => contact.value)).not.toContain('+258821112233');
    expect(body.contacts).toHaveLength(5);
    expect(body.socialLinks.map((link) => link.platform)).toEqual(['linkedin', 'facebook']);
    const text = JSON.stringify(body);
    for (const secret of ['821112233', 'paula.privado', 'ownerUserId', 'isPublic', 'slug', 'companyId']) {
      expect(text).not.toContain(secret);
    }
  });

  it('respeita a visibilidade por campo', async () => {
    const body = await readJson<PublicCard>(await publicCard(`/api/public/cards/${tokenOf('c_carlos')}`));
    expect(body.bio).toBeNull();
    expect(body.title).toBe('Técnico Comercial');
    expect(getDb().profiles.find((profile) => profile.id === 'p_carlos')?.bio).not.toBeNull();
  });

  it('dá exatamente a mesma resposta 404 a tudo o que não seja um cartão ativo com perfil', async () => {
    getDb().cards.find((card) => card.id === 'c_stock_001')!.status = 'active';
    const paths = [
      `/api/public/cards/${MOCK_TOKENS.blockedCard}`,
      `/api/public/cards/${tokenOf('c_paula2')}`,
      `/api/public/cards/${tokenOf('c_lost')}`,
      `/api/public/cards/${tokenOf('c_stock_001')}`,
      '/api/public/cards/Ab3_-Ab3_-Ab3_-Ab3_-Ab',
      '/api/public/cards/abc',
      `/api/public/cards/${encodeURIComponent("' OR 1=1 --")}`,
    ];
    const bodies = new Set<string>();
    for (const path of paths) {
      const response = await publicCard(path);
      expect(response.status).toBe(404);
      bodies.add(await response.text());
    }
    expect(bodies.size).toBe(1);
    expect([...bodies][0]).toBe(JSON.stringify({ error: { code: 'not_found' } }));
  });
});

describe('GET /api/public/profiles/:slug', () => {
  it('mostra o mesmo conteúdo que o token do cartão ativo do perfil', async () => {
    const bySlug = await readJson<PublicCard>(await publicCard(`/api/public/profiles/${MOCK_TOKENS.ownerSlug}`));
    const byToken = await readJson<PublicCard>(await publicCard(`/api/public/cards/${ACTIVE}`));
    expect(bySlug).toEqual(byToken);
  });

  it('dá 404 a endereços desconhecidos, mal formados ou de perfis sem cartão ativo', async () => {
    expect((await publicCard('/api/public/profiles/ninguem-aqui')).status).toBe(404);
    expect((await publicCard('/api/public/profiles/Paula_Machava')).status).toBe(404);
    expect((await publicCard('/api/public/profiles/rececao-acme')).status).toBe(200);
    getDb().cards.find((card) => card.id === 'c_recepcao')!.status = 'inactive';
    expect((await publicCard('/api/public/profiles/rececao-acme')).status).toBe(404);
  });
});

describe('GET .../contact.vcf', () => {
  it('devolve um vCard 4.0 com os campos públicos e o link do cartão', async () => {
    const response = await publicCard(`/api/public/cards/${ACTIVE}/contact.vcf`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/vcard; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="paula-machava.vcf"');
    const vcf = await response.text();
    const lines = vcf.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCARD');
    expect(lines[1]).toBe('VERSION:4.0');
    expect(lines).toContain('FN:Paula Machava');
    expect(lines).toContain('ORG:Acme Moçambique');
    expect(lines).toContain('TEL;TYPE=cell,voice;VALUE=uri:tel:+258841234567');
    expect(lines).toContain('EMAIL;TYPE=work:paula.machava@acme.test');
    expect(lines).toContain('ADR;TYPE=work:;;Av. Julius Nyerere 1234\\, Maputo;;;;');
    expect(lines).toContain(`URL;TYPE=x-nfc-card:${location.origin}/c/${ACTIVE}`);
    expect(vcf).not.toContain('821112233');
    expect(vcf).not.toContain('instagram');
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it('também está disponível pelo endereço amigável e dá 404 nos outros casos', async () => {
    const bySlug = await publicCard(`/api/public/profiles/${MOCK_TOKENS.ownerSlug}/contact.vcf`);
    expect(bySlug.status).toBe(200);
    expect(await bySlug.text()).toBe(await (await publicCard(`/api/public/cards/${ACTIVE}/contact.vcf`)).text());
    expect((await publicCard(`/api/public/cards/${MOCK_TOKENS.blockedCard}/contact.vcf`)).status).toBe(404);
    expect((await publicCard('/api/public/profiles/ninguem/contact.vcf')).status).toBe(404);
  });
});

describe('POST /api/public/events', () => {
  it('regista a lista fechada de eventos e deduplica durante 30 minutos', async () => {
    expect((await event({ type: 'view', token: ACTIVE })).status).toBe(204);
    expect((await event({ type: 'view', token: ACTIVE })).status).toBe(204);
    expect(counter('c_paula', 'views')).toBe(1);

    await event({ type: 'whatsapp_click', token: ACTIVE });
    await event({ type: 'email_click', token: ACTIVE });
    await event({ type: 'vcf_download', slug: MOCK_TOKENS.ownerSlug });
    expect(counter('c_paula', 'clicks')).toBe(2);
    expect(counter('c_paula', 'vcfDownloads')).toBe(1);

    getDb().attempts['event:view:c_paula'] = [Date.now() - 31 * 60_000];
    await event({ type: 'view', token: ACTIVE });
    expect(counter('c_paula', 'views')).toBe(2);
  });

  it('responde 204 sem registar nada para cartões indisponíveis ou desconhecidos', async () => {
    for (const body of [
      { type: 'view', token: MOCK_TOKENS.blockedCard },
      { type: 'view', token: 'Ab3_-Ab3_-Ab3_-Ab3_-Ab' },
      { type: 'view', slug: 'ninguem-aqui' },
    ]) {
      expect((await event(body)).status).toBe(204);
    }
    expect(Object.keys(getDb().counters)).toHaveLength(0);
  });

  it('recusa eventos fora da lista, identificadores mal formados e pedidos sem token CSRF', async () => {
    expect((await event({ type: 'contact_sent', token: ACTIVE })).status).toBe(422);
    expect((await event({ type: 'view', token: 'curto' })).status).toBe(422);
    expect((await event({ type: 'view' })).status).toBe(422);
    expect((await event({ type: 'view', token: ACTIVE, ip: '1.2.3.4' })).status).toBe(422);
    expect((await event({ type: 'view', token: ACTIVE }, false)).status).toBe(403);
    expect(Object.keys(getDb().counters)).toHaveLength(0);
  });
});
