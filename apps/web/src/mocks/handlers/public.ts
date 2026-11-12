// Handlers públicos da API simulada (FRONTEND «Página pública»; CLAUDE.md, regras 4 e 6). Não há sessão:
// só cartões ativos com perfil respondem; tudo o resto dá exatamente o mesmo 404.
import { HttpResponse, type HttpHandler } from 'msw';
import type { PublicEventType } from '@nfc-business/shared/constants';
import { publicEventRequestSchema, type PublicCard } from '@nfc-business/shared/schemas';
import { isCardToken, isSlug } from '@nfc-business/shared/validators';
import type { DbCard, DbProfile, MockDb } from '../db';
import { activeCardOf, bumpCounter, type Metric } from '../domain';
import { buildVCard } from '../vcard';
import { fail, hitLimit, noContent, readBody, route } from './http';

/** Deduplicação dos eventos públicos (CLAUDE.md, regra 6). */
const DEDUPE_WINDOW_MS = 30 * 60_000;
/** A página pública pode ser guardada em cache durante 60 segundos (CLAUDE.md, regra 4). */
const CACHE_CONTROL = 'public, max-age=60';

const METRIC_OF: Record<PublicEventType, Metric> = {
  view: 'views',
  whatsapp_click: 'clicks',
  email_click: 'clicks',
  vcf_download: 'vcfDownloads',
};

interface PublicTarget {
  card: DbCard;
  profile: DbProfile;
}

/** Cartão ativo com perfil, pelo token. Desconhecido, mal formado, inativo, perdido, bloqueado ou sem perfil: `null`. */
function byToken(db: MockDb, token: string): PublicTarget | null {
  if (!isCardToken(token)) return null;
  const card = db.cards.find((candidate) => candidate.token === token && candidate.status === 'active');
  const profile = card?.profileId ? db.profiles.find((candidate) => candidate.id === card.profileId) : undefined;
  return card && profile ? { card, profile } : null;
}

/** O mesmo, pelo endereço amigável: o perfil precisa de um cartão ativo. */
function bySlug(db: MockDb, slug: string): PublicTarget | null {
  if (!isSlug(slug)) return null;
  const profile = db.profiles.find((candidate) => candidate.slug === slug);
  const card = profile ? activeCardOf(db, profile.id) : undefined;
  return card && profile ? { card, profile } : null;
}

/** A vista `public_profiles`: só os campos marcados como públicos; o nome é sempre público (P-05). */
export function toPublicCard(profile: DbProfile): PublicCard {
  const show = profile.visibility;
  return {
    profileId: profile.id,
    displayName: profile.displayName,
    title: show.title ? profile.title : null,
    company: show.company ? profile.company : null,
    bio: show.bio ? profile.bio : null,
    photoUrl: show.photo ? profile.photoUrl : null,
    contacts: profile.contacts.filter((contact) => contact.isPublic).map(({ type, value }) => ({ type, value })),
    socialLinks: profile.socialLinks.filter((link) => link.isPublic).map(({ platform, url }) => ({ platform, url })),
    theme: profile.theme,
  };
}

function cardResponse(target: PublicTarget | null): Response {
  if (!target) fail(404, 'not_found');
  return HttpResponse.json(toPublicCard(target.profile), { status: 200, headers: { 'Cache-Control': CACHE_CONTROL } });
}

function vcfResponse(target: PublicTarget | null, origin: string): Response {
  if (!target) fail(404, 'not_found');
  const publicCard = toPublicCard(target.profile);
  const body = buildVCard({
    displayName: publicCard.displayName,
    title: publicCard.title,
    company: publicCard.company,
    contacts: publicCard.contacts,
    socialLinks: publicCard.socialLinks,
    cardUrl: `${origin}/c/${target.card.token}`,
    revision: target.profile.updatedAt,
  });
  return new HttpResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${target.profile.slug}.vcf"`,
      'Cache-Control': CACHE_CONTROL,
    },
  });
}

export const publicHandlers: HttpHandler[] = [
  route('get', '/api/public/cards/:token', ({ db, param }) => cardResponse(byToken(db, param('token')))),
  route('get', '/api/public/cards/:token/contact.vcf', ({ db, param, url }) =>
    vcfResponse(byToken(db, param('token')), url.origin),
  ),
  route('get', '/api/public/profiles/:slug', ({ db, param }) => cardResponse(bySlug(db, param('slug')))),
  route('get', '/api/public/profiles/:slug/contact.vcf', ({ db, param, url }) =>
    vcfResponse(bySlug(db, param('slug')), url.origin),
  ),

  // Lista fechada de eventos. Responde sempre 204, exista ou não o cartão, para não revelar nada.
  route('post', '/api/public/events', async ({ db, request }) => {
    const body = await readBody(request, publicEventRequestSchema);
    const target = 'token' in body ? byToken(db, body.token) : bySlug(db, body.slug);
    if (target && hitLimit(db, `event:${body.type}:${target.card.id}`, 1, DEDUPE_WINDOW_MS) === null) {
      bumpCounter(db, target.card.id, METRIC_OF[body.type]);
    }
    return noContent();
  }),
];
