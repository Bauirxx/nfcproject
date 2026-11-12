// Handlers de empresas da API simulada: só platform_admin (FRONTEND «Empresas»).
import type { HttpHandler } from 'msw';
import { companyCreateRequestSchema, companyUpdateRequestSchema, type Company } from '@nfc-business/shared/schemas';
import { nextId, type DbCompany, type MockDb } from '../db';
import { emailTaken, inviteUser, isoNow, recordAudit } from '../domain';
import { fail, json, readBody, requirePermission, route } from './http';
import { consumeUpload } from './uploads';

export function toCompany(db: MockDb, company: DbCompany): Company {
  return {
    id: company.id,
    name: company.name,
    contactEmail: company.contactEmail,
    logoUrl: company.logoUrl,
    brand: company.brand,
    cardsCount: db.cards.filter((card) => card.companyId === company.id).length,
    membersCount: db.users.filter((user) => user.companyId === company.id).length,
    createdAt: company.createdAt,
  };
}

function companyOr404(db: MockDb, id: string): DbCompany {
  return db.companies.find((company) => company.id === id) ?? fail(404, 'not_found');
}

export const companyHandlers: HttpHandler[] = [
  route('get', '/api/companies', ({ db }) => {
    requirePermission(db, 'companies.manage');
    const items = [...db.companies]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      .map((company) => toCompany(db, company));
    return json({ items });
  }),

  // Cria a empresa e convida o primeiro administrador (P-09): o registo é só por convite.
  route('post', '/api/companies', async ({ db, request }) => {
    const actor = requirePermission(db, 'companies.manage');
    const body = await readBody(request, companyCreateRequestSchema);
    if (emailTaken(db, body.adminEmail)) fail(409, 'already_member');
    const logoUrl = body.logoFileId ? consumeUpload(db, actor, body.logoFileId, 'company_logo') : null;
    const company: DbCompany = {
      id: nextId('co'),
      name: body.name,
      contactEmail: body.contactEmail,
      logoUrl,
      brand: body.brand,
      createdAt: isoNow(),
    };
    db.companies.push(company);
    inviteUser(db, body.adminEmail, 'company_admin', company.id);
    recordAudit(db, actor, 'company.created', company.name, company.id);
    recordAudit(db, actor, 'member.invited', body.adminEmail, company.id);
    return json(toCompany(db, company), 201);
  }),

  route('get', '/api/companies/:id', ({ db, param }) => {
    requirePermission(db, 'companies.manage');
    return json(toCompany(db, companyOr404(db, param('id'))));
  }),

  route('patch', '/api/companies/:id', async ({ db, request, param }) => {
    const actor = requirePermission(db, 'companies.manage');
    const company = companyOr404(db, param('id'));
    const body = await readBody(request, companyUpdateRequestSchema);
    if (body.logoFileId === null) company.logoUrl = null;
    else if (body.logoFileId !== undefined) company.logoUrl = consumeUpload(db, actor, body.logoFileId, 'company_logo');
    if (body.name !== undefined) company.name = body.name;
    if (body.contactEmail !== undefined) company.contactEmail = body.contactEmail;
    if (body.brand !== undefined) company.brand = body.brand;
    recordAudit(db, actor, 'company.updated', company.name, company.id);
    return json(toCompany(db, company));
  }),
];
