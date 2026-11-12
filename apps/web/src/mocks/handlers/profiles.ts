// Handlers de perfis digitais da API simulada (FRONTEND «Perfis» e «Temas»; pressupostos P-02 a P-05 e P-10).
import type { HttpHandler } from 'msw';
import { DEFAULT_THEME } from '@nfc-business/shared/constants';
import { can } from '@nfc-business/shared/permissions';
import {
  profileCreateRequestSchema,
  profileListQuerySchema,
  profileUpdateRequestSchema,
  type Profile,
} from '@nfc-business/shared/schemas';
import { isSlug } from '@nfc-business/shared/validators';
import { nextId, type DbProfile, type DbUser, type MockDb } from '../db';
import { activeCardOf, companyName, isoNow, recordAudit } from '../domain';
import { fail, json, paginate, readBody, readQuery, requireCompany, requirePermission, route } from './http';
import { consumeUpload } from './uploads';

export function toProfile(db: MockDb, profile: DbProfile): Profile {
  const owner = profile.ownerUserId === null ? null : db.users.find((user) => user.id === profile.ownerUserId);
  return {
    id: profile.id,
    slug: profile.slug,
    ownerUserId: profile.ownerUserId,
    ownerName: owner ? (owner.name ?? owner.email) : null,
    displayName: profile.displayName,
    title: profile.title,
    company: profile.company,
    bio: profile.bio,
    photoUrl: profile.photoUrl,
    visibility: profile.visibility,
    contacts: profile.contacts,
    socialLinks: profile.socialLinks,
    theme: profile.theme,
    activeCardToken: activeCardOf(db, profile.id)?.token ?? null,
    cardsCount: db.cards.filter((card) => card.profileId === profile.id).length,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/** Perfis que o utilizador pode ver: os da sua empresa; o profile_owner só vê os seus (P-04). */
export function visibleProfiles(db: MockDb, user: DbUser): DbProfile[] {
  const companyId = requireCompany(user);
  return db.profiles.filter(
    (profile) => profile.companyId === companyId && (user.role !== 'profile_owner' || profile.ownerUserId === user.id),
  );
}

/** Perfil visível para o utilizador; os outros dão 404 (CLAUDE.md, regra 2). */
export function profileOr404(db: MockDb, user: DbUser, id: string): DbProfile {
  return visibleProfiles(db, user).find((profile) => profile.id === id) ?? fail(404, 'not_found');
}

function companyUserOr404(db: MockDb, companyId: string, userId: string): DbUser {
  return db.users.find((user) => user.id === userId && user.companyId === companyId) ?? fail(404, 'not_found');
}

/** Endereço amigável único a partir do nome: minúsculas, sem acentos, só letras, dígitos e hífens. */
export function slugFor(db: MockDb, displayName: string): string {
  let base = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (base.length < 3) base = base === '' ? 'perfil' : `perfil-${base}`;
  if (!isSlug(base)) base = 'perfil';
  let slug = base;
  for (let suffix = 2; db.profiles.some((profile) => profile.slug === slug); suffix += 1) {
    slug = `${base}-${suffix}`;
  }
  return slug;
}

function emptyToNull(value: string | null): string | null {
  return value === '' ? null : value;
}

function matchesSearch(profile: DbProfile, search: string): boolean {
  const needle = search.toLowerCase();
  return [profile.displayName, profile.title ?? '', profile.company ?? ''].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

export const profileHandlers: HttpHandler[] = [
  route('get', '/api/profiles', ({ db, url }) => {
    const user = requirePermission(db, 'profiles.view');
    const query = readQuery(url, profileListQuerySchema);
    const profiles = visibleProfiles(db, user)
      .filter((profile) => !query.search || matchesSearch(profile, query.search))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt'))
      .map((profile) => toProfile(db, profile));
    return json(paginate(profiles, query.page, query.pageSize));
  }),

  route('post', '/api/profiles', async ({ db, request }) => {
    const actor = requirePermission(db, 'profiles.create');
    const companyId = requireCompany(actor);
    const body = await readBody(request, profileCreateRequestSchema);
    // Só company_admin atribui o dono (P-10).
    if (body.ownerUserId !== undefined && !can(actor.role, 'profiles.assignOwner')) fail(403, 'forbidden');
    const owner = body.ownerUserId ? companyUserOr404(db, companyId, body.ownerUserId) : null;
    const now = isoNow();
    const profile: DbProfile = {
      id: nextId('p'),
      companyId,
      slug: slugFor(db, body.displayName),
      ownerUserId: owner?.id ?? null,
      displayName: body.displayName,
      title: null,
      company: companyName(db, companyId),
      bio: null,
      photoUrl: null,
      visibility: { title: true, company: true, bio: true, photo: true },
      contacts: [],
      socialLinks: [],
      theme: { ...DEFAULT_THEME },
      createdAt: now,
      updatedAt: now,
    };
    db.profiles.push(profile);
    recordAudit(db, actor, 'profile.created', profile.displayName);
    return json(toProfile(db, profile), 201);
  }),

  route('get', '/api/profiles/:id', ({ db, param }) => {
    const user = requirePermission(db, 'profiles.view');
    return json(toProfile(db, profileOr404(db, user, param('id'))));
  }),

  route('patch', '/api/profiles/:id', async ({ db, request, param }) => {
    const actor = requirePermission(db, 'profiles.edit');
    const profile = profileOr404(db, actor, param('id'));
    const body = await readBody(request, profileUpdateRequestSchema);

    // Autorizações antes de qualquer alteração: dono só por company_admin (P-10), tema só por quem gere temas (P-03).
    if (body.ownerUserId !== undefined && !can(actor.role, 'profiles.assignOwner')) fail(403, 'forbidden');
    if (body.theme !== undefined && !can(actor.role, 'themes.manage')) fail(403, 'forbidden');
    const owner = body.ownerUserId ? companyUserOr404(db, profile.companyId, body.ownerUserId) : null;

    if (body.photoFileId === null) profile.photoUrl = null;
    else if (body.photoFileId !== undefined) {
      profile.photoUrl = consumeUpload(db, actor, body.photoFileId, 'profile_photo');
    }

    if (body.theme !== undefined) {
      const { logoFileId, ...colors } = body.theme;
      const logoUrl =
        logoFileId === undefined
          ? profile.theme.logoUrl
          : logoFileId === null
            ? null
            : consumeUpload(db, actor, logoFileId, 'theme_logo');
      profile.theme = { ...colors, logoUrl };
    }

    if (body.ownerUserId !== undefined) profile.ownerUserId = owner?.id ?? null;
    if (body.displayName !== undefined) profile.displayName = body.displayName;
    if (body.title !== undefined) profile.title = emptyToNull(body.title);
    if (body.company !== undefined) profile.company = emptyToNull(body.company);
    if (body.bio !== undefined) profile.bio = emptyToNull(body.bio);
    if (body.visibility !== undefined) profile.visibility = body.visibility;
    if (body.contacts !== undefined) profile.contacts = body.contacts;
    if (body.socialLinks !== undefined) profile.socialLinks = body.socialLinks;
    profile.updatedAt = isoNow();
    recordAudit(db, actor, 'profile.updated', profile.displayName);
    return json(toProfile(db, profile));
  }),
];
