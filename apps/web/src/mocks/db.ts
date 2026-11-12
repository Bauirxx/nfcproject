// Base de dados da API simulada (MSW). Faz o papel do backend em desenvolvimento, nos testes e no build de e2e;
// nunca entra no build de produção. No browser é guardada em localStorage, só com dados fictícios.
import type {
  AuditAction,
  CardHistoryAction,
  CardStatus,
  Role,
  ShareChannel,
  UploadMimeType,
  UploadPurpose,
} from '@nfc-business/shared/constants';
import type {
  CompanyBrand,
  ProfileContact,
  ProfileSocialLink,
  ProfileTheme,
  ProfileVisibility,
} from '@nfc-business/shared/schemas';
import { createSeed, DB_VERSION } from './seed';

export interface DbUser {
  id: string;
  /** `null` enquanto o convite não for aceite. */
  name: string | null;
  email: string;
  /** Texto simples porque são dados fictícios; `null` enquanto o convite não for aceite. */
  password: string | null;
  role: Role;
  companyId: string | null;
  status: 'active' | 'invited';
  totpSecret: string | null;
  /** Chave gerada em `mfa/setup`, ainda por confirmar. */
  pendingTotpSecret: string | null;
  recoveryCodes: string[];
  createdAt: string;
}

export interface DbCompany {
  id: string;
  name: string;
  contactEmail: string;
  logoUrl: string | null;
  brand: CompanyBrand;
  createdAt: string;
}

export interface DbCardHistoryEntry {
  id: string;
  action: CardHistoryAction;
  actorName: string;
  createdAt: string;
}

export interface DbCard {
  id: string;
  companyId: string;
  label: string;
  token: string;
  status: CardStatus;
  profileId: string | null;
  /** Peso da atividade de demonstração nas estatísticas; 0 nos cartões criados durante a simulação. */
  demoWeight: number;
  history: DbCardHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DbProfile {
  id: string;
  companyId: string;
  slug: string;
  ownerUserId: string | null;
  displayName: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  photoUrl: string | null;
  visibility: ProfileVisibility;
  contacts: ProfileContact[];
  socialLinks: ProfileSocialLink[];
  theme: ProfileTheme;
  createdAt: string;
  updatedAt: string;
}

export interface DbShare {
  id: string;
  companyId: string;
  userId: string;
  profileId: string;
  cardId: string | null;
  channel: ShareChannel;
  /** Só se guarda o destinatário já mascarado: o valor completo nunca fica no browser. */
  recipientMasked: string;
  createdAt: string;
}

export interface DbAuditEntry {
  id: string;
  action: AuditAction;
  actorName: string;
  actorEmail: string;
  target: string | null;
  companyId: string | null;
  createdAt: string;
}

export interface DbSession {
  id: string;
  userId: string;
  device: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface DbUpload {
  id: string;
  userId: string;
  purpose: UploadPurpose;
  contentType: UploadMimeType;
  size: number;
  /** Preenchido quando o ficheiro chega ao URL assinado. */
  dataUrl: string | null;
}

export interface DbOneTimeToken {
  userId: string;
  expiresAt: string;
}

/** Faz o papel dos cookies HttpOnly, que o JavaScript da aplicação nunca vê. */
export interface DbCookies {
  sessionId: string | null;
  /** Fim da validade do access token (15 minutos), em milissegundos. */
  accessExpiresAt: number;
  /** Login com palavra-passe certa, à espera do segundo passo. */
  mfaPendingUserId: string | null;
}

export interface MockDb {
  version: number;
  sequence: number;
  users: DbUser[];
  companies: DbCompany[];
  cards: DbCard[];
  profiles: DbProfile[];
  shares: DbShare[];
  audit: DbAuditEntry[];
  sessions: DbSession[];
  uploads: Record<string, DbUpload>;
  /** Eventos registados durante a simulação: `<cardId>|<AAAA-MM-DD>|<métrica>` → contagem. */
  counters: Record<string, number>;
  resetTokens: Record<string, DbOneTimeToken>;
  inviteTokens: Record<string, DbOneTimeToken>;
  /** Instantes (ms) das tentativas recentes, por chave de limite, por exemplo `login:<email>`. */
  attempts: Record<string, number[]>;
  cookies: DbCookies;
  csrfToken: string;
}

const STORAGE_KEY = 'nfc-business-mock-db';

let db: MockDb = createSeed(Date.now());
let persistent = false;
let lastRaw: string | null = null;

export function getDb(): MockDb {
  return db;
}

/** Repõe os dados de demonstração. */
export function resetDb(now: number = Date.now()): MockDb {
  db = createSeed(now);
  saveDb();
  return db;
}

/** Só no browser: os dados sobrevivem a recarregamentos e são partilhados entre separadores. */
export function enablePersistence(): void {
  persistent = true;
  if (!loadDb()) saveDb();
}

/** Lê o estado guardado. Devolve `false` se não existir, estiver corrompido ou for de outra versão. */
export function loadDb(): boolean {
  if (!persistent) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    if (raw === lastRaw) return true;
    const stored = JSON.parse(raw) as Partial<MockDb> | null;
    if (!stored || stored.version !== DB_VERSION) return false;
    db = stored as MockDb;
    lastRaw = raw;
    return true;
  } catch {
    return false;
  }
}

export function saveDb(): void {
  if (!persistent) return;
  try {
    const raw = JSON.stringify(db);
    if (raw === lastRaw) return;
    localStorage.setItem(STORAGE_KEY, raw);
    lastRaw = raw;
  } catch {
    // Sem espaço ou com o armazenamento bloqueado: a simulação continua só em memória.
    persistent = false;
  }
}

export function nextId(prefix: string): string {
  db.sequence += 1;
  return `${prefix}_${db.sequence.toString(36).padStart(4, '0')}`;
}

/** Token aleatório em base64url; com 16 bytes dá os 22 caracteres do token de um cartão. */
export function randomToken(bytes: number = 16): string {
  let binary = '';
  for (const byte of crypto.getRandomValues(new Uint8Array(bytes))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
