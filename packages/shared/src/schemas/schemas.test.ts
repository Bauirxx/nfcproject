import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { LIMITS } from '../constants';
import {
  cardListQuerySchema,
  companyCreateRequestSchema,
  contactShareRequestSchema,
  emailSchema,
  inviteAcceptRequestSchema,
  loginResponseSchema,
  mfaVerifyRequestSchema,
  paginationQuerySchema,
  passwordSchema,
  profileContactSchema,
  profileSocialLinkSchema,
  profileThemeInputSchema,
  publicEventRequestSchema,
  recoveryCodeSchema,
  sessionResponseSchema,
  uploadSignRequestSchema,
  uploadSignResponseSchema,
} from './index';

function issueCodes(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

const user = {
  id: 'u1',
  name: 'Ana Admin',
  email: 'ana.admin@acme.test',
  role: 'company_admin',
  companyId: 'c1',
  companyName: 'Acme',
  mfaEnabled: true,
  mfaRequired: true,
};

describe('schemas comuns', () => {
  it('normaliza o email', () => {
    expect(emailSchema.parse('  Ana@Acme.Test ')).toBe('ana@acme.test');
    expect(issueCodes(emailSchema, 'ana@acme')).toContain('invalid_email');
    expect(issueCodes(emailSchema, '')).toContain('required');
  });

  it('exige palavras-passe de 12 a 128 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(LIMITS.passwordMin)).success).toBe(true);
    expect(issueCodes(passwordSchema, 'a'.repeat(11))).toEqual(['password_too_short']);
    expect(issueCodes(passwordSchema, 'a'.repeat(129))).toEqual(['password_too_long']);
  });

  it('aplica valores por defeito e limites à paginação', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
    expect(paginationQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe('schemas de autenticação', () => {
  it('a sessão pode não ter utilizador, mas traz sempre o token CSRF', () => {
    expect(sessionResponseSchema.safeParse({ user: null, csrfToken: 'a'.repeat(32) }).success).toBe(true);
    expect(sessionResponseSchema.safeParse({ user, csrfToken: 'a'.repeat(32) }).success).toBe(true);
    expect(sessionResponseSchema.safeParse({ user: null }).success).toBe(false);
    expect(sessionResponseSchema.safeParse({ user: { ...user, role: 'root' }, csrfToken: 'a'.repeat(32) }).success).toBe(false);
  });

  it('o login devolve sessão ou pedido de MFA', () => {
    expect(loginResponseSchema.safeParse({ status: 'authenticated', user }).success).toBe(true);
    expect(loginResponseSchema.safeParse({ status: 'mfa_required' }).success).toBe(true);
    expect(loginResponseSchema.safeParse({ status: 'authenticated' }).success).toBe(false);
    expect(loginResponseSchema.safeParse({ status: 'other' }).success).toBe(false);
  });

  it('a verificação de MFA aceita código TOTP ou código de recuperação', () => {
    expect(mfaVerifyRequestSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(mfaVerifyRequestSchema.safeParse({ recoveryCode: 'ABCDE-23456' }).success).toBe(true);
    expect(mfaVerifyRequestSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(mfaVerifyRequestSchema.safeParse({ code: '12345a' }).success).toBe(false);
    expect(recoveryCodeSchema.parse(' abcde-23456 ')).toBe('ABCDE-23456');
    expect(issueCodes(recoveryCodeSchema, 'ABCDE23456')).toEqual(['invalid_recovery_code']);
  });

  it('aceitar convite exige nome e palavra-passe forte', () => {
    const base = { token: 't'.repeat(32), name: 'Novo Membro', password: 'a'.repeat(12) };
    expect(inviteAcceptRequestSchema.safeParse(base).success).toBe(true);
    expect(issueCodes(inviteAcceptRequestSchema, { ...base, password: 'curta' })).toContain('password_too_short');
    expect(issueCodes(inviteAcceptRequestSchema, { ...base, name: 'A' })).toContain('too_short');
  });
});

describe('schemas de empresas e cartões', () => {
  it('criar empresa exige o email do primeiro administrador', () => {
    const base = {
      name: 'Acme, Lda.',
      contactEmail: 'geral@acme.test',
      adminEmail: 'ana.admin@acme.test',
      brand: { primaryColor: '#1e40af', accentColor: '#0f766e' },
    };
    expect(companyCreateRequestSchema.safeParse(base).success).toBe(true);
    expect(companyCreateRequestSchema.safeParse({ ...base, adminEmail: undefined }).success).toBe(false);
    expect(issueCodes(companyCreateRequestSchema, { ...base, brand: { primaryColor: 'azul', accentColor: '#0f766e' } })).toContain(
      'invalid_color',
    );
  });

  it('a lista de cartões só aceita estados conhecidos', () => {
    expect(cardListQuerySchema.parse({ status: 'active', search: ' ana ' })).toEqual({
      page: 1,
      pageSize: 20,
      status: 'active',
      search: 'ana',
    });
    expect(cardListQuerySchema.safeParse({ status: 'stolen' }).success).toBe(false);
  });
});

describe('schemas de perfil', () => {
  it('valida cada contacto segundo o seu tipo', () => {
    const contact = (type: string, value: string) => ({ id: 'k1', type, value, isPublic: true });
    expect(profileContactSchema.safeParse(contact('phone', '+258841234567')).success).toBe(true);
    expect(profileContactSchema.safeParse(contact('email', 'ana@acme.test')).success).toBe(true);
    expect(profileContactSchema.safeParse(contact('website', 'https://acme.test')).success).toBe(true);
    expect(profileContactSchema.safeParse(contact('location', 'Av. 25 de Setembro, Maputo')).success).toBe(true);

    expect(issueCodes(profileContactSchema, contact('whatsapp', '841234567'))).toEqual(['invalid_phone']);
    expect(issueCodes(profileContactSchema, contact('email', 'ana@'))).toEqual(['invalid_email']);
    expect(issueCodes(profileContactSchema, contact('website', 'http://acme.test'))).toEqual(['invalid_url']);
    expect(issueCodes(profileContactSchema, contact('website', 'javascript:alert(1)'))).toEqual(['invalid_url']);
    expect(issueCodes(profileContactSchema, contact('location', 'ab'))).toEqual(['invalid_location']);
    expect(profileContactSchema.safeParse(contact('fax', '+258841234567')).success).toBe(false);
  });

  it('o erro do contacto aponta para o campo do valor', () => {
    const result = profileContactSchema.safeParse({ id: 'k1', type: 'phone', value: 'abc', isPublic: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['value']]);
  });

  it('as redes sociais só aceitam https em domínios permitidos', () => {
    const link = (platform: string, url: string) => ({ id: 's1', platform, url, isPublic: true });
    expect(profileSocialLinkSchema.safeParse(link('linkedin', 'https://www.linkedin.com/in/ana')).success).toBe(true);
    expect(issueCodes(profileSocialLinkSchema, link('linkedin', 'https://evil.test/in/ana'))).toEqual(['invalid_social_url']);
    expect(issueCodes(profileSocialLinkSchema, link('instagram', 'http://instagram.com/ana'))).toEqual(['invalid_social_url']);
    expect(profileSocialLinkSchema.safeParse(link('myspace', 'https://myspace.com/ana')).success).toBe(false);
  });

  it('o tema tem de cumprir o contraste AA', () => {
    const theme = { template: 'classic', primaryColor: '#1e40af', backgroundColor: '#ffffff', textColor: '#0f172a' };
    expect(profileThemeInputSchema.safeParse(theme).success).toBe(true);
    expect(issueCodes(profileThemeInputSchema, { ...theme, textColor: '#cccccc' })).toEqual(['low_contrast_text']);
    expect(issueCodes(profileThemeInputSchema, { ...theme, primaryColor: '#fefefe' })).toEqual(['low_contrast_primary']);
    expect(profileThemeInputSchema.safeParse({ ...theme, template: 'neon' }).success).toBe(false);
  });
});

describe('schemas da página pública e de uploads', () => {
  it('os eventos públicos são uma lista fechada', () => {
    const token = 'Ab3_-Ab3_-Ab3_-Ab3_-Ab';
    expect(publicEventRequestSchema.safeParse({ type: 'view', token }).success).toBe(true);
    expect(publicEventRequestSchema.safeParse({ type: 'vcf_download', slug: 'ana-silva' }).success).toBe(true);
    expect(publicEventRequestSchema.safeParse({ type: 'contact_sent', token }).success).toBe(false);
    expect(publicEventRequestSchema.safeParse({ type: 'view', token: 'curto' }).success).toBe(false);
  });

  it('os uploads só aceitam JPEG, PNG e WebP até 2 MB', () => {
    const base = { purpose: 'profile_photo', contentType: 'image/png', size: 1024 };
    expect(uploadSignRequestSchema.safeParse(base).success).toBe(true);
    expect(uploadSignRequestSchema.safeParse({ ...base, contentType: 'image/svg+xml' }).success).toBe(false);
    expect(uploadSignRequestSchema.safeParse({ ...base, contentType: 'image/gif' }).success).toBe(false);
    expect(issueCodes(uploadSignRequestSchema, { ...base, size: LIMITS.uploadMaxBytes + 1 })).toEqual(['file_too_large']);
    expect(uploadSignRequestSchema.safeParse({ ...base, size: LIMITS.uploadMaxBytes }).success).toBe(true);
  });

  it('o URL de upload tem de ser um caminho /api/ na mesma origem', () => {
    expect(uploadSignResponseSchema.safeParse({ fileId: 'f1', uploadUrl: '/api/uploads/f1?sig=abc' }).success).toBe(true);
    expect(uploadSignResponseSchema.safeParse({ fileId: 'f1', uploadUrl: 'https://evil.test/upload' }).success).toBe(false);
    expect(uploadSignResponseSchema.safeParse({ fileId: 'f1', uploadUrl: '//evil.test/api/x' }).success).toBe(false);
    expect(uploadSignResponseSchema.safeParse({ fileId: 'f1', uploadUrl: '/uploads/f1' }).success).toBe(false);
  });
});

describe('schema do envio de contacto', () => {
  const base = { profileId: 'p1', channel: 'email', recipient: { email: 'cliente@example.com' } };

  it('aceita envio por email, WhatsApp e SMS com o destinatário certo', () => {
    expect(contactShareRequestSchema.safeParse(base).success).toBe(true);
    expect(
      contactShareRequestSchema.safeParse({ ...base, channel: 'whatsapp', recipient: { name: 'João', phone: '+258841234567' } })
        .success,
    ).toBe(true);
    expect(contactShareRequestSchema.safeParse({ ...base, channel: 'sms', recipient: { phone: '+258841234567' } }).success).toBe(true);
  });

  it('exige email no canal email e telefone nos outros canais', () => {
    expect(issueCodes(contactShareRequestSchema, { ...base, recipient: { phone: '+258841234567' } })).toEqual(['recipient_required']);
    expect(issueCodes(contactShareRequestSchema, { ...base, channel: 'sms', recipient: { email: 'cliente@example.com' } })).toEqual([
      'recipient_required',
    ]);
    expect(issueCodes(contactShareRequestSchema, { ...base, channel: 'whatsapp', recipient: { phone: '841234567' } })).toContain(
      'invalid_phone',
    );
  });

  it('a nota é texto simples até 200 caracteres, sem links nem HTML', () => {
    expect(contactShareRequestSchema.safeParse({ ...base, note: 'Foi um prazer.\nAté breve!' }).success).toBe(true);
    expect(issueCodes(contactShareRequestSchema, { ...base, note: 'a'.repeat(201) })).toContain('note_too_long');
    expect(issueCodes(contactShareRequestSchema, { ...base, note: 'veja https://evil.test' })).toEqual(['note_invalid']);
    expect(issueCodes(contactShareRequestSchema, { ...base, note: '<img src=x onerror=alert(1)>' })).toEqual(['note_invalid']);
  });

  it('não aceita canais fora da lista', () => {
    expect(contactShareRequestSchema.safeParse({ ...base, channel: 'telegram' }).success).toBe(false);
  });
});
