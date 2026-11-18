// Perfis contra a base de dados real (só com DB_INTEGRATION=1): slug único entre empresas, edição, permissões,
// isolamento entre empresas (404) e reflexo na página pública. Os dados de teste são apagados no fim.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { profileSchema } from '@nfc-business/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { AuthedRequest } from '../common/auth.guard';
import type { SessionUser } from '../common/session-user';
import { loadEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { PublicCardService } from '../public/public-card.service';
import { ProfilesController } from './profiles.controller';
import type { UploadsService } from '../uploads/uploads.service';

const enabled = process.env.DB_INTEGRATION === '1';
if (enabled) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem `.env`: usa o ambiente atual.
  }
}

const base = { mfaEnabled: true, mfaRequired: true, companyName: null, name: 'Teste', email: 't@exemplo.test' };
const adminA: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000da', role: 'company_admin', companyId: 'co_itp_a' };
const editorA: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000db', role: 'company_editor', companyId: 'co_itp_a', mfaRequired: false };
const ownerA: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000dc', role: 'profile_owner', companyId: 'co_itp_a', mfaRequired: false };
const adminB: SessionUser = { ...base, id: '00000000-0000-0000-0000-0000000000dd', role: 'company_admin', companyId: 'co_itp_b' };
const req = (user: SessionUser) => ({ user }) as unknown as AuthedRequest;

describe.runIf(enabled)('Perfis (base de dados real)', () => {
  const database = new DatabaseService(loadEnv({ ...process.env, NODE_ENV: 'test' }));
  const profiles = new ProfilesController(
    database,
    { record: async () => undefined } as unknown as AuditService,
    {} as unknown as UploadsService,
  );
  const publicCards = new PublicCardService(database);
  const admin = { companyId: null, isPlatformAdmin: true };
  let profileId = '';

  async function cleanup() {
    await database.withContext(admin, async (db) => {
      await db.query(`delete from app.cards where company_id in ('co_itp_a', 'co_itp_b')`);
      await db.query(`delete from app.profiles where company_id in ('co_itp_a', 'co_itp_b')`);
      await db.query(`delete from app.companies where id in ('co_itp_a', 'co_itp_b')`);
    });
  }

  beforeAll(async () => {
    await cleanup();
    await database.withContext(admin, (db) =>
      db.query(`insert into app.companies (id, name, contact_email) values
        ('co_itp_a', 'ITP Empresa A', 'a@exemplo.test'), ('co_itp_b', 'ITP Empresa B', 'b@exemplo.test')`),
    );
  });

  afterAll(async () => {
    await cleanup();
    await database.onModuleDestroy();
  });

  it('cria com slug a partir do nome (sem acentos) e o mesmo nome noutra empresa recebe um sufixo', async () => {
    const created = await profiles.create({ displayName: 'Zé Itptestes Único' }, req(adminA));
    expect(profileSchema.safeParse(created).success).toBe(true);
    expect(created).toMatchObject({ slug: 'ze-itptestes-unico', company: 'ITP Empresa A', ownerUserId: null });
    profileId = created.id;
    const sameName = await profiles.create({ displayName: 'Zé Itptestes Único' }, req(adminB));
    expect(sameName.slug).toBe('ze-itptestes-unico-2');
  });

  it('edita campos, contactos e tema; os campos privados não aparecem na página pública', async () => {
    const updated = await profiles.update(
      profileId,
      {
        title: 'Diretora',
        bio: '',
        visibility: { title: false, company: true, bio: true, photo: true },
        contacts: [
          { id: 'k1', type: 'phone', value: '+258841234567', isPublic: true },
          { id: 'k2', type: 'email', value: 'privado@exemplo.test', isPublic: false },
        ],
        theme: { template: 'modern', primaryColor: '#1e40af', backgroundColor: '#ffffff', textColor: '#0f172a' },
      },
      req(adminA),
    );
    expect(updated).toMatchObject({ title: 'Diretora', bio: null, theme: { template: 'modern', logoUrl: null } });
    expect(updated.contacts).toHaveLength(2);

    await database.withContext(admin, (db) =>
      db.query(`insert into app.cards (company_id, label, token, status, profile_id)
        values ('co_itp_a', 'Cartão ITP', 'ItpPublicoAAAAAAAAAAAA', 'active', $1)`, [profileId]),
    );
    const target = await publicCards.find({ token: 'ItpPublicoAAAAAAAAAAAA' });
    expect(target?.card.title).toBeNull();
    expect(JSON.stringify(target?.card)).not.toContain('privado@exemplo.test');
    expect((await profiles.get(profileId, req(adminA))).activeCardToken).toBe('ItpPublicoAAAAAAAAAAAA');
  });

  it('permissões: o editor não atribui dono nem cria com dono; o dono de perfil só vê os seus', async () => {
    await expect(profiles.update(profileId, { ownerUserId: null }, req(editorA))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(profiles.create({ displayName: 'Com dono', ownerUserId: null }, req(editorA))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const ownList = await profiles.list({ page: 1, pageSize: 50 }, req(ownerA));
    expect(ownList.items).toEqual([]);
    await expect(profiles.get(profileId, req(ownerA))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('isolamento: a empresa B recebe 404 no perfil da A e não o vê na lista', async () => {
    await expect(profiles.get(profileId, req(adminB))).rejects.toBeInstanceOf(NotFoundException);
    await expect(profiles.update(profileId, { title: 'Roubado' }, req(adminB))).rejects.toBeInstanceOf(NotFoundException);
    const listB = await profiles.list({ page: 1, pageSize: 50 }, req(adminB));
    expect(listB.items.some((profile) => profile.id === profileId)).toBe(false);
    const search = await profiles.list({ page: 1, pageSize: 50, search: 'itptestes' }, req(adminA));
    expect(search.items.map((profile) => profile.id)).toEqual([profileId]);
  });
});
