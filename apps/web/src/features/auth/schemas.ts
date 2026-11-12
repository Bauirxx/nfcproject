// Schemas só de formulário (confirmação da palavra-passe). O token vem do URL, não do formulário.
// Vivem no frontend porque acrescentam campos que o pedido à API não tem (nota do ADR sobre Zod 4).
import { passwordSchema, personNameSchema } from '@nfc-business/shared/schemas';
import { z } from 'zod';

const passwordPair = {
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'required'),
};

function matchPasswords(values: { password: string; confirmPassword: string }, ctx: z.RefinementCtx) {
  if (values.password !== values.confirmPassword) {
    ctx.addIssue({ code: 'custom', message: 'password_mismatch', path: ['confirmPassword'] });
  }
}

export const resetPasswordFormSchema = z.object(passwordPair).superRefine(matchPasswords);
export type ResetPasswordForm = z.infer<typeof resetPasswordFormSchema>;

export const inviteFormSchema = z.object({ name: personNameSchema, ...passwordPair }).superRefine(matchPasswords);
export type InviteForm = z.infer<typeof inviteFormSchema>;
