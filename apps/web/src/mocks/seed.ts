// Dados de demonstração da API simulada. Tudo fictício (domínios .test) e determinístico:
// as datas são relativas ao instante dado e os tokens vêm de um gerador com semente fixa.
import {
  DEFAULT_THEME,
  type AuditAction,
  type CardHistoryAction,
  type CardStatus,
  type Role,
  type ShareChannel,
} from '@nfc-business/shared/constants';
import { maskEmail, maskPhone } from '@nfc-business/shared/links';
import { MOCK_RECOVERY_CODES, MOCK_TOKENS, MOCK_USERS } from './credentials';
import type { DbAuditEntry, DbCard, DbCardHistoryEntry, DbProfile, DbShare, DbUser, MockDb } from './db';

/** Muda sempre que a forma dos dados muda: os dados guardados com outra versão são substituídos. */
export const DB_VERSION = 1;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const STOCK_CARDS = 22;

const ACME = 'co_acme';
const BETA = 'co_beta';

/** Gerador determinístico (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Credentials {
  email: string;
  password: string;
  totpSecret: string | null;
}

function activeUser(
  id: string,
  name: string,
  credentials: Credentials,
  role: Role,
  companyId: string | null,
  createdAt: string,
  recoveryCodes: string[] = [],
): DbUser {
  return {
    id,
    name,
    email: credentials.email,
    password: credentials.password,
    role,
    companyId,
    status: 'active',
    totpSecret: credentials.totpSecret,
    pendingTotpSecret: null,
    recoveryCodes,
    createdAt,
  };
}

export function createSeed(now: number): MockDb {
  const random = createRandom(20_260_101);
  const ago = (days: number, hours: number = 0): string => new Date(now - days * DAY - hours * HOUR).toISOString();
  const fixtureToken = (): string => {
    let token = '';
    for (let index = 0; index < 22; index += 1) token += BASE64URL.charAt(Math.floor(random() * BASE64URL.length));
    return token;
  };

  const users: DbUser[] = [
    activeUser('u_marta', 'Marta Nhaca', MOCK_USERS.platformAdmin, 'platform_admin', null, ago(400), [
      MOCK_RECOVERY_CODES.platformAdmin,
      'NFCBP-A2B3C',
    ]),
    activeUser('u_ana', 'Ana Macuácua', MOCK_USERS.companyAdmin, 'company_admin', ACME, ago(380), [
      MOCK_RECOVERY_CODES.companyAdmin,
      'NFCBA-D4E5F',
    ]),
    activeUser('u_edu', 'Eduardo Sitoe', MOCK_USERS.editor, 'company_editor', ACME, ago(300)),
    activeUser('u_paula', 'Paula Machava', MOCK_USERS.owner, 'profile_owner', ACME, ago(260)),
    activeUser(
      'u_carlos',
      'Carlos Mondlane',
      { email: 'carlos.owner@acme.test', password: 'Perfil#2026okay', totpSecret: null },
      'profile_owner',
      ACME,
      ago(200),
    ),
    {
      id: 'u_convidado',
      name: null,
      email: 'convidado@acme.test',
      password: null,
      role: 'profile_owner',
      companyId: ACME,
      status: 'invited',
      totpSecret: null,
      pendingTotpSecret: null,
      recoveryCodes: [],
      createdAt: ago(2),
    },
    activeUser('u_nelson', 'Nelson Tembe', MOCK_USERS.newAdmin, 'company_admin', BETA, ago(24)),
    activeUser(
      'u_rita',
      'Rita Cossa',
      { email: 'rita.owner@beta.test', password: 'Perfil#2026okay', totpSecret: null },
      'profile_owner',
      BETA,
      ago(20),
    ),
  ];

  const profiles: DbProfile[] = [
    {
      id: 'p_paula',
      companyId: ACME,
      slug: MOCK_TOKENS.ownerSlug,
      ownerUserId: 'u_paula',
      displayName: 'Paula Machava',
      title: 'Gestora Comercial',
      company: 'Acme Moçambique',
      bio: 'Ajudo empresas a encontrar soluções de embalagem à medida. Fale comigo para pedir um orçamento.',
      photoUrl: null,
      visibility: { title: true, company: true, bio: true, photo: true },
      contacts: [
        { id: 'ct_paula_1', type: 'phone', value: '+258841234567', isPublic: true },
        { id: 'ct_paula_2', type: 'whatsapp', value: '+258841234567', isPublic: true },
        { id: 'ct_paula_3', type: 'email', value: 'paula.machava@acme.test', isPublic: true },
        { id: 'ct_paula_4', type: 'website', value: 'https://www.acme.test', isPublic: true },
        { id: 'ct_paula_5', type: 'location', value: 'Av. Julius Nyerere 1234, Maputo', isPublic: true },
        // Contacto privado: nunca pode aparecer na página pública nem no VCF.
        { id: 'ct_paula_6', type: 'phone', value: '+258821112233', isPublic: false },
      ],
      socialLinks: [
        { id: 'sl_paula_1', platform: 'linkedin', url: 'https://www.linkedin.com/in/paula-machava', isPublic: true },
        { id: 'sl_paula_2', platform: 'facebook', url: 'https://www.facebook.com/acme.mocambique', isPublic: true },
        { id: 'sl_paula_3', platform: 'instagram', url: 'https://www.instagram.com/paula.privado', isPublic: false },
      ],
      theme: { ...DEFAULT_THEME },
      createdAt: ago(255),
      updatedAt: ago(1, 4),
    },
    {
      id: 'p_carlos',
      companyId: ACME,
      slug: 'carlos-mondlane',
      ownerUserId: 'u_carlos',
      displayName: 'Carlos Mondlane',
      title: 'Técnico Comercial',
      company: 'Acme Moçambique',
      bio: 'Assistência técnica e visitas a clientes na zona sul.',
      photoUrl: null,
      visibility: { title: true, company: true, bio: false, photo: true },
      contacts: [
        { id: 'ct_carlos_1', type: 'phone', value: '+258861234567', isPublic: true },
        { id: 'ct_carlos_2', type: 'email', value: 'carlos.mondlane@acme.test', isPublic: true },
      ],
      socialLinks: [],
      theme: { template: 'modern', primaryColor: '#0f766e', backgroundColor: '#ffffff', textColor: '#0f172a', logoUrl: null },
      createdAt: ago(198),
      updatedAt: ago(15),
    },
    {
      id: 'p_recepcao',
      companyId: ACME,
      slug: 'rececao-acme',
      ownerUserId: null,
      displayName: 'Receção Acme',
      title: 'Atendimento ao cliente',
      company: 'Acme Moçambique',
      bio: null,
      photoUrl: null,
      visibility: { title: true, company: true, bio: true, photo: true },
      contacts: [
        { id: 'ct_recepcao_1', type: 'phone', value: '+25821123456', isPublic: true },
        { id: 'ct_recepcao_2', type: 'email', value: 'geral@acme.test', isPublic: true },
        { id: 'ct_recepcao_3', type: 'website', value: 'https://www.acme.test', isPublic: true },
        { id: 'ct_recepcao_4', type: 'location', value: 'Av. Julius Nyerere 1234, Maputo', isPublic: true },
      ],
      socialLinks: [],
      theme: { ...DEFAULT_THEME, template: 'minimal' },
      createdAt: ago(190),
      updatedAt: ago(60),
    },
    {
      id: 'p_rita',
      companyId: BETA,
      slug: 'rita-cossa',
      ownerUserId: 'u_rita',
      displayName: 'Rita Cossa',
      title: 'Coordenadora de Operações',
      company: 'Beta Logística',
      bio: null,
      photoUrl: null,
      visibility: { title: true, company: true, bio: true, photo: true },
      contacts: [
        { id: 'ct_rita_1', type: 'phone', value: '+258871234567', isPublic: true },
        { id: 'ct_rita_2', type: 'email', value: 'rita.cossa@beta.test', isPublic: true },
      ],
      socialLinks: [],
      theme: { ...DEFAULT_THEME },
      createdAt: ago(19),
      updatedAt: ago(19),
    },
  ];

  let historyIndex = 0;
  const history = (steps: Array<[CardHistoryAction, string, string]>): DbCardHistoryEntry[] =>
    steps.map(([action, actorName, createdAt]) => {
      historyIndex += 1;
      return { id: `h_${historyIndex}`, action, actorName, createdAt };
    });

  const card = (
    id: string,
    companyId: string,
    label: string,
    token: string,
    status: CardStatus,
    profileId: string | null,
    demoWeight: number,
    entries: DbCardHistoryEntry[],
  ): DbCard => ({
    id,
    companyId,
    label,
    token,
    status,
    profileId,
    demoWeight,
    history: entries,
    createdAt: entries[0]?.createdAt ?? ago(0),
    updatedAt: entries[entries.length - 1]?.createdAt ?? ago(0),
  });

  const cards: DbCard[] = [
    card('c_paula', ACME, 'Paula Machava · principal', MOCK_TOKENS.activeCard, 'active', 'p_paula', 1, history([
      ['created', 'Ana Macuácua', ago(250)],
      ['profile_linked', 'Ana Macuácua', ago(250)],
      ['activated', 'Ana Macuácua', ago(249)],
    ])),
    card('c_paula2', ACME, 'Paula Machava · reserva', fixtureToken(), 'inactive', 'p_paula', 0, history([
      ['created', 'Eduardo Sitoe', ago(120)],
      ['profile_linked', 'Eduardo Sitoe', ago(120)],
    ])),
    card('c_carlos', ACME, 'Carlos Mondlane', fixtureToken(), 'active', 'p_carlos', 0.6, history([
      ['created', 'Ana Macuácua', ago(195)],
      ['profile_linked', 'Ana Macuácua', ago(195)],
      ['activated', 'Eduardo Sitoe', ago(194)],
    ])),
    card('c_recepcao', ACME, 'Receção · balcão', fixtureToken(), 'active', 'p_recepcao', 0.35, history([
      ['created', 'Eduardo Sitoe', ago(188)],
      ['profile_linked', 'Eduardo Sitoe', ago(188)],
      ['activated', 'Eduardo Sitoe', ago(188)],
    ])),
    card('c_lost', ACME, 'Carlos Mondlane · feira', fixtureToken(), 'lost', 'p_carlos', 0, history([
      ['created', 'Ana Macuácua', ago(90)],
      ['profile_linked', 'Ana Macuácua', ago(90)],
      ['activated', 'Ana Macuácua', ago(89)],
      ['lost', 'Eduardo Sitoe', ago(31)],
    ])),
    card('c_blocked', ACME, 'Receção · antigo', MOCK_TOKENS.blockedCard, 'blocked', 'p_recepcao', 0, history([
      ['created', 'Ana Macuácua', ago(300)],
      ['profile_linked', 'Ana Macuácua', ago(300)],
      ['activated', 'Ana Macuácua', ago(299)],
      ['blocked', 'Ana Macuácua', ago(189)],
    ])),
  ];
  for (let index = 1; index <= STOCK_CARDS; index += 1) {
    const number = String(index).padStart(3, '0');
    cards.push(
      card(`c_stock_${number}`, ACME, `Stock ${number}`, fixtureToken(), 'inactive', null, 0, history([
        ['created', 'Eduardo Sitoe', ago(45, index)],
      ])),
    );
  }
  cards.push(
    card('c_rita', BETA, 'Rita Cossa', fixtureToken(), 'active', 'p_rita', 0.3, history([
      ['created', 'Nelson Tembe', ago(18)],
      ['profile_linked', 'Nelson Tembe', ago(18)],
      ['activated', 'Nelson Tembe', ago(18)],
    ])),
    card('c_beta_stock', BETA, 'Stock Beta 001', fixtureToken(), 'inactive', null, 0, history([
      ['created', 'Nelson Tembe', ago(18)],
    ])),
  );

  let shareIndex = 0;
  const share = (
    companyId: string,
    userId: string,
    profileId: string,
    cardId: string,
    channel: ShareChannel,
    recipientMasked: string,
    createdAt: string,
  ): DbShare => {
    shareIndex += 1;
    return { id: `sh_${shareIndex}`, companyId, userId, profileId, cardId, channel, recipientMasked, createdAt };
  };

  const shares: DbShare[] = [
    share(ACME, 'u_paula', 'p_paula', 'c_paula', 'email', maskEmail('joao.matola@cliente.test'), ago(1, 3)),
    share(ACME, 'u_paula', 'p_paula', 'c_paula', 'whatsapp', maskPhone('+258845550101'), ago(2, 5)),
    share(ACME, 'u_paula', 'p_paula', 'c_paula', 'sms', maskPhone('+258825550102'), ago(6)),
    share(ACME, 'u_edu', 'p_recepcao', 'c_recepcao', 'email', maskEmail('compras@fornecedor.test'), ago(9)),
    share(ACME, 'u_carlos', 'p_carlos', 'c_carlos', 'whatsapp', maskPhone('+258865550103'), ago(12)),
    share(ACME, 'u_ana', 'p_carlos', 'c_carlos', 'email', maskEmail('direcao@parceiro.test'), ago(20)),
    share(BETA, 'u_rita', 'p_rita', 'c_rita', 'email', maskEmail('cliente@porto.test'), ago(3)),
  ];

  const actors = {
    marta: { actorName: 'Marta Nhaca', actorEmail: MOCK_USERS.platformAdmin.email, companyId: null },
    ana: { actorName: 'Ana Macuácua', actorEmail: MOCK_USERS.companyAdmin.email, companyId: ACME },
    edu: { actorName: 'Eduardo Sitoe', actorEmail: MOCK_USERS.editor.email, companyId: ACME },
    paula: { actorName: 'Paula Machava', actorEmail: MOCK_USERS.owner.email, companyId: ACME },
    nelson: { actorName: 'Nelson Tembe', actorEmail: MOCK_USERS.newAdmin.email, companyId: BETA },
  } as const;

  const auditTemplate: Array<[AuditAction, keyof typeof actors, string | null]> = [
    ['auth.login', 'ana', null],
    ['contact.sent', 'paula', 'Paula Machava'],
    ['profile.updated', 'paula', 'Paula Machava'],
    ['auth.login', 'paula', null],
    ['member.invited', 'ana', 'convidado@acme.test'],
    ['card.created', 'edu', 'Stock 022'],
    ['auth.login', 'edu', null],
    ['contact.sent', 'edu', 'Receção Acme'],
    ['auth.login_failed', 'ana', null],
    ['card.lost', 'edu', 'Carlos Mondlane · feira'],
    ['profile.updated', 'edu', 'Carlos Mondlane'],
    ['member.role_changed', 'ana', 'edu.editor@acme.test'],
    ['auth.password_changed', 'paula', null],
    ['card.activated', 'ana', 'Carlos Mondlane · feira'],
    ['card.created', 'ana', 'Carlos Mondlane · feira'],
    ['auth.logout', 'ana', null],
  ];

  const audit: DbAuditEntry[] = [];
  for (let round = 0; round < 2; round += 1) {
    auditTemplate.forEach(([action, actorKey, target], index) => {
      audit.push({
        id: `a_${audit.length + 1}`,
        action,
        ...actors[actorKey],
        target,
        createdAt: ago(round * 40 + index * 2, index),
      });
    });
  }
  audit.push(
    { id: `a_${audit.length + 1}`, action: 'company.created', ...actors.marta, target: 'Beta Logística', companyId: BETA, createdAt: ago(25) },
    { id: `a_${audit.length + 2}`, action: 'member.invited', ...actors.marta, target: MOCK_USERS.newAdmin.email, companyId: BETA, createdAt: ago(25) },
    { id: `a_${audit.length + 3}`, action: 'card.created', ...actors.nelson, target: 'Rita Cossa', createdAt: ago(18) },
    { id: `a_${audit.length + 4}`, action: 'card.activated', ...actors.nelson, target: 'Rita Cossa', createdAt: ago(18) },
    { id: `a_${audit.length + 5}`, action: 'auth.login', ...actors.marta, target: null, createdAt: ago(1) },
  );
  audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const farFuture = new Date(now + 365 * DAY).toISOString();

  return {
    version: DB_VERSION,
    sequence: 1000,
    users,
    companies: [
      {
        id: ACME,
        name: 'Acme Moçambique',
        contactEmail: 'geral@acme.test',
        logoUrl: null,
        brand: { primaryColor: '#1e40af', accentColor: '#0f766e' },
        createdAt: ago(380),
      },
      {
        id: BETA,
        name: 'Beta Logística',
        contactEmail: 'contacto@beta.test',
        logoUrl: null,
        brand: { primaryColor: '#9a3412', accentColor: '#1d4ed8' },
        createdAt: ago(25),
      },
    ],
    cards,
    profiles,
    shares,
    audit,
    sessions: [
      { id: 's_ana_1', userId: 'u_ana', device: 'Chrome em Windows', createdAt: ago(6), lastSeenAt: ago(0, 5) },
      { id: 's_ana_2', userId: 'u_ana', device: 'Safari em iPhone', createdAt: ago(14), lastSeenAt: ago(2) },
      { id: 's_paula_1', userId: 'u_paula', device: 'Chrome em Android', createdAt: ago(3), lastSeenAt: ago(0, 8) },
      { id: 's_marta_1', userId: 'u_marta', device: 'Firefox em Windows', createdAt: ago(9), lastSeenAt: ago(1) },
    ],
    uploads: {},
    counters: {},
    // Os links fictícios de recuperação e de convite ficam válidos durante muito tempo, para facilitar a demonstração.
    resetTokens: { [MOCK_TOKENS.reset]: { userId: 'u_paula', expiresAt: farFuture } },
    inviteTokens: { [MOCK_TOKENS.invite]: { userId: 'u_convidado', expiresAt: farFuture } },
    attempts: {},
    cookies: { sessionId: null, accessExpiresAt: 0, mfaPendingUserId: null },
    csrfToken: fixtureToken(),
  };
}
