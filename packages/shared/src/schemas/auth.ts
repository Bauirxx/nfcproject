import { z } from 'zod';
import { ROLES } from '../constants';
import { dateTimeSchema, emailSchema, idSchema, passwordSchema, personNameSchema } from './common';

export const roleSchema = z.enum(ROLES);

export const sessionUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  role: roleSchema,
  companyId: idSchema.nullable(),
  companyName: z.string().nullable(),
  mfaEnabled: z.boolean(),
  /** Verdadeiro para administradores: sem MFA configurado, a interface obriga à configuração. */
  mfaRequired: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema.nullable(),
  csrfToken: z.string().min(16),
  /** Sem utilizador mas com refresh token válido: o cliente deve renovar a sessão (ADR-0005). */
  refreshable: z.boolean().optional(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // No login só se exige que exista: a política de tamanho aplica-se ao definir a palavra-passe.
  password: z.string().min(1, 'required').max(128, 'too_long'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('authenticated'), user: sessionUserSchema }),
  z.object({ status: z.literal('mfa_required') }),
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'invalid_code');

export const recoveryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/, 'invalid_recovery_code');

export const mfaVerifyRequestSchema = z.union([
  z.object({ code: totpCodeSchema }),
  z.object({ recoveryCode: recoveryCodeSchema }),
]);
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

export const mfaVerifyResponseSchema = z.object({ user: sessionUserSchema });
export type MfaVerifyResponse = z.infer<typeof mfaVerifyResponseSchema>;

export const mfaSetupResponseSchema = z.object({
  secret: z.string().min(16),
  otpauthUrl: z.string().startsWith('otpauth://totp/'),
});
export type MfaSetupResponse = z.infer<typeof mfaSetupResponseSchema>;

export const mfaConfirmRequestSchema = z.object({ code: totpCodeSchema });
export type MfaConfirmRequest = z.infer<typeof mfaConfirmRequestSchema>;

export const mfaConfirmResponseSchema = z.object({ recoveryCodes: z.array(z.string()).min(1) });
export type MfaConfirmResponse = z.infer<typeof mfaConfirmResponseSchema>;

export const mfaDisableRequestSchema = z.object({ password: z.string().min(1, 'required').max(128, 'too_long') });
export type MfaDisableRequest = z.infer<typeof mfaDisableRequestSchema>;

export const recoverRequestSchema = z.object({ email: emailSchema });
export type RecoverRequest = z.infer<typeof recoverRequestSchema>;

const oneTimeTokenSchema = z.string().min(16).max(256);

export const recoverConfirmRequestSchema = z.object({ token: oneTimeTokenSchema, password: passwordSchema });
export type RecoverConfirmRequest = z.infer<typeof recoverConfirmRequestSchema>;

export const inviteAcceptRequestSchema = z.object({
  token: oneTimeTokenSchema,
  name: personNameSchema,
  password: passwordSchema,
});
export type InviteAcceptRequest = z.infer<typeof inviteAcceptRequestSchema>;

export const accountUpdateRequestSchema = z.object({ name: personNameSchema });
export type AccountUpdateRequest = z.infer<typeof accountUpdateRequestSchema>;

export const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1, 'required').max(128, 'too_long'),
  newPassword: passwordSchema,
});
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;

export const authSessionSchema = z.object({
  id: idSchema,
  /** Descrição do dispositivo já resumida pelo backend, por exemplo «Chrome em Android». */
  device: z.string(),
  createdAt: dateTimeSchema,
  lastSeenAt: dateTimeSchema,
  current: z.boolean(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authSessionListSchema = z.object({ items: z.array(authSessionSchema) });
export type AuthSessionList = z.infer<typeof authSessionListSchema>;
