// Único sítio com os caminhos da API (ADR-0004). Todos começam por /api/, na mesma origem.
import type { CardAction } from '@nfc-business/shared/constants';

const id = encodeURIComponent;

export const endpoints = {
  auth: {
    session: '/api/auth/session',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    mfaVerify: '/api/auth/mfa/verify',
    mfaSetup: '/api/auth/mfa/setup',
    mfaConfirm: '/api/auth/mfa/confirm',
    mfaDisable: '/api/auth/mfa/disable',
    recover: '/api/auth/recover',
    recoverConfirm: '/api/auth/recover/confirm',
    inviteAccept: '/api/auth/invite/accept',
    account: '/api/auth/account',
    password: '/api/auth/password',
    sessions: '/api/auth/sessions',
  },
  companies: {
    list: '/api/companies',
    one: (companyId: string) => `/api/companies/${id(companyId)}`,
  },
  members: {
    list: '/api/members',
    one: (memberId: string) => `/api/members/${id(memberId)}`,
  },
  cards: {
    list: '/api/cards',
    one: (cardId: string) => `/api/cards/${id(cardId)}`,
    action: (cardId: string, action: CardAction) => `/api/cards/${id(cardId)}/${action}`,
    history: (cardId: string) => `/api/cards/${id(cardId)}/history`,
  },
  profiles: {
    list: '/api/profiles',
    one: (profileId: string) => `/api/profiles/${id(profileId)}`,
  },
  uploads: {
    sign: '/api/uploads/sign',
  },
  contactShares: {
    list: '/api/contact-shares',
  },
  analytics: {
    summary: '/api/analytics/summary',
  },
  audit: {
    list: '/api/audit',
  },
  public: {
    card: (token: string) => `/api/public/cards/${id(token)}`,
    cardVcf: (token: string) => `/api/public/cards/${id(token)}/contact.vcf`,
    profile: (slug: string) => `/api/public/profiles/${id(slug)}`,
    profileVcf: (slug: string) => `/api/public/profiles/${id(slug)}/contact.vcf`,
    events: '/api/public/events',
  },
} as const;
