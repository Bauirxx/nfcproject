// Constantes do contrato entre frontend e backend. Sem dependências: pode ser importado pela página pública.

export const ROLES = ['platform_admin', 'company_admin', 'company_editor', 'profile_owner'] as const;
export type Role = (typeof ROLES)[number];

/** Papéis que um company_admin pode atribuir a membros da sua empresa. */
export const MEMBER_ROLES = ['company_admin', 'company_editor', 'profile_owner'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** MFA TOTP obrigatório (CLAUDE.md, regra 1). */
export const MFA_REQUIRED_ROLES: readonly Role[] = ['platform_admin', 'company_admin'];

export const CARD_STATUSES = ['active', 'inactive', 'lost', 'blocked'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_ACTIONS = ['activate', 'deactivate', 'lost', 'block'] as const;
export type CardAction = (typeof CARD_ACTIONS)[number];

/** Transições assumidas pela interface (ADR-0004: por confirmar no backend). `blocked` é terminal. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardAction[]> = {
  inactive: ['activate', 'lost', 'block'],
  active: ['deactivate', 'lost', 'block'],
  lost: ['activate', 'block'],
  blocked: [],
};

export const CARD_HISTORY_ACTIONS = [
  'created',
  'updated',
  'profile_linked',
  'profile_unlinked',
  'activated',
  'deactivated',
  'lost',
  'blocked',
] as const;
export type CardHistoryAction = (typeof CARD_HISTORY_ACTIONS)[number];

/** Lista fechada de eventos públicos (CLAUDE.md, regra 7). `contact_sent` só é registado pelo backend. */
export const PUBLIC_EVENT_TYPES = ['view', 'whatsapp_click', 'email_click', 'vcf_download'] as const;
export type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];

export const CONTACT_TYPES = ['phone', 'whatsapp', 'email', 'website', 'location'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const SHARE_CHANNELS = ['email', 'whatsapp', 'sms'] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** Redes sociais aceites e respetivos domínios (CLAUDE.md, regra 4). */
export const SOCIAL_PLATFORMS = {
  linkedin: { label: 'LinkedIn', domains: ['linkedin.com'] },
  facebook: { label: 'Facebook', domains: ['facebook.com', 'fb.com'] },
  instagram: { label: 'Instagram', domains: ['instagram.com'] },
  x: { label: 'X', domains: ['x.com', 'twitter.com'] },
  youtube: { label: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
  tiktok: { label: 'TikTok', domains: ['tiktok.com'] },
  github: { label: 'GitHub', domains: ['github.com'] },
  telegram: { label: 'Telegram', domains: ['t.me', 'telegram.me'] },
} as const satisfies Record<string, { label: string; domains: readonly string[] }>;
export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;
export const SOCIAL_PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS) as [SocialPlatform, ...SocialPlatform[]];

export const THEME_TEMPLATES = ['classic', 'modern', 'minimal'] as const;
export type ThemeTemplate = (typeof THEME_TEMPLATES)[number];

export const DEFAULT_THEME = {
  template: 'classic',
  primaryColor: '#1e40af',
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  logoUrl: null,
} as const;

export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];

export const UPLOAD_PURPOSES = ['profile_photo', 'company_logo', 'theme_logo'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const RATE_LIMIT_SCOPES = ['hour', 'day', 'company'] as const;
export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[number];

export const DEFAULT_PHONE_PREFIX = '+258';

export const LIMITS = {
  passwordMin: 12,
  passwordMax: 128,
  nameMin: 2,
  nameMax: 80,
  titleMax: 80,
  companyMax: 80,
  bioMax: 300,
  cardLabelMax: 60,
  locationMax: 200,
  noteMax: 200,
  contactsMax: 10,
  socialLinksMax: 8,
  urlMax: 2048,
  emailMax: 254,
  uploadMaxBytes: 2 * 1024 * 1024,
  photo: { minWidth: 200, minHeight: 200, maxWidth: 4000, maxHeight: 4000 },
  logo: { minWidth: 64, minHeight: 64, maxWidth: 4000, maxHeight: 4000 },
  sharesPerHour: 10,
  sharesPerDay: 50,
  pageSizeMax: 100,
} as const;

/** Ações registadas na auditoria (ADR-0004: lista por confirmar no backend). */
export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.mfa_enabled',
  'auth.password_changed',
  'auth.sessions_revoked',
  'company.created',
  'company.updated',
  'member.invited',
  'member.role_changed',
  'member.removed',
  'card.created',
  'card.updated',
  'card.activated',
  'card.deactivated',
  'card.lost',
  'card.blocked',
  'profile.created',
  'profile.updated',
  'contact.sent',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
