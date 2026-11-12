import { z } from 'zod';
import { LIMITS, SHARE_CHANNELS } from '../constants';
import { isSingleLineText, isValidNote } from '../validators';
import {
  dateTimeSchema,
  emailSchema,
  idSchema,
  paginatedSchema,
  paginationQuerySchema,
  phoneSchema,
  type Paginated,
} from './common';

export const shareChannelSchema = z.enum(SHARE_CHANNELS);

export const shareNoteSchema = z
  .string()
  .trim()
  .max(LIMITS.noteMax, 'note_too_long')
  .refine(isValidNote, 'note_invalid');

export const shareRecipientNameSchema = z
  .string()
  .trim()
  .max(LIMITS.nameMax, 'too_long')
  .refine(isSingleLineText, 'invalid_text');

/** Corpo de `POST /api/contact-shares`. O backend regista o envio em todos os canais e envia o email. */
export const contactShareRequestSchema = z
  .object({
    profileId: idSchema,
    channel: shareChannelSchema,
    recipient: z.object({
      name: shareRecipientNameSchema.optional(),
      phone: phoneSchema.optional(),
      email: emailSchema.optional(),
    }),
    note: shareNoteSchema.optional(),
  })
  .superRefine((share, ctx) => {
    if (share.channel === 'email' && !share.recipient.email) {
      ctx.addIssue({ code: 'custom', message: 'recipient_required', path: ['recipient', 'email'] });
    }
    if (share.channel !== 'email' && !share.recipient.phone) {
      ctx.addIssue({ code: 'custom', message: 'recipient_required', path: ['recipient', 'phone'] });
    }
  });
export type ContactShareRequest = z.infer<typeof contactShareRequestSchema>;

export const contactShareSchema = z.object({
  id: idSchema,
  profileId: idSchema,
  profileName: z.string(),
  channel: shareChannelSchema,
  /** O destinatário chega sempre mascarado; o valor completo nunca volta ao cliente. */
  recipientMasked: z.string(),
  createdAt: dateTimeSchema,
});
export type ContactShare = z.infer<typeof contactShareSchema>;

export const contactSharePageSchema = paginatedSchema(contactShareSchema);
export type ContactSharePage = Paginated<ContactShare>;

export const contactShareListQuerySchema = paginationQuerySchema.extend({
  profileId: idSchema.optional(),
});
export type ContactShareListQuery = z.input<typeof contactShareListQuerySchema>;
