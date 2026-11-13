import { zodResolver } from '@hookform/resolvers/zod';
import { DEFAULT_PHONE_PREFIX, SHARE_CHANNELS, type ShareChannel } from '@nfc-business/shared/constants';
import {
  buildCardUrl,
  buildShareMessage,
  buildSmsUrl,
  buildWhatsAppUrl,
} from '@nfc-business/shared/links';
import { shareChannelSchema, shareNoteSchema, shareRecipientNameSchema, type ContactShareRequest } from '@nfc-business/shared/schemas';
import { isEmail, normalizePhone } from '@nfc-business/shared/validators';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { TextareaField } from '@/shared/components/ui/textarea';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';
import { contactTexts, shareChannelLabels } from '@/shared/i18n/panel/contact';
import { validationMessage } from '@/shared/i18n/validation';
import { useCreateContactShare, type SendableProfile } from './queries';

const sendFormSchema = z
  .object({
    profileId: z.string().min(1, 'required'),
    channel: shareChannelSchema,
    recipientName: shareRecipientNameSchema,
    email: z.string().trim(),
    phone: z.string().trim(),
    note: shareNoteSchema,
  })
  .superRefine((values, ctx) => {
    if (values.channel === 'email') {
      if (values.email === '') ctx.addIssue({ code: 'custom', path: ['email'], message: 'required' });
      else if (!isEmail(values.email)) ctx.addIssue({ code: 'custom', path: ['email'], message: 'invalid_email' });
    } else {
      if (values.phone === '') ctx.addIssue({ code: 'custom', path: ['phone'], message: 'required' });
      else if (!normalizePhone(values.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'invalid_phone' });
    }
  });

type SendFormValues = z.input<typeof sendFormSchema>;

/** Abre o link externo (wa.me ou sms:) numa nova aba, sem referência à origem. */
function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface SendContactFormProps {
  profiles: SendableProfile[];
  /** Perfil pré-selecionado; se houver só um, é esse. */
  defaultProfileId?: string;
  onSent?: () => void;
}

export function SendContactForm({ profiles, defaultProfileId, onSent }: SendContactFormProps) {
  const send = useCreateContactShare();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const initialProfile = defaultProfileId ?? (profiles.length === 1 ? profiles[0]?.id : '') ?? '';

  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: { profileId: initialProfile, channel: 'email', recipientName: '', email: '', phone: '', note: '' },
  });

  const control = form.control;
  const channel = useWatch({ control, name: 'channel' }) as ShareChannel;
  const profileId = useWatch({ control, name: 'profileId' });
  const recipientName = useWatch({ control, name: 'recipientName' });
  const note = useWatch({ control, name: 'note' });
  const selected = profiles.find((profile) => profile.id === profileId);

  const cardUrl = selected ? (buildCardUrl(origin, selected.activeCardToken) ?? '') : '';
  const previewMessage = selected
    ? buildShareMessage({
        senderName: selected.displayName,
        recipientName: recipientName.trim() || undefined,
        cardUrl,
        note: note.trim() || undefined,
      })
    : null;

  function onSubmit(values: SendFormValues) {
    const profile = profiles.find((item) => item.id === values.profileId);
    if (!profile) return;
    const name = values.recipientName.trim();
    const trimmedNote = values.note.trim();
    const phone = values.channel === 'email' ? null : normalizePhone(values.phone);

    const recipient =
      values.channel === 'email'
        ? { ...(name ? { name } : {}), email: values.email }
        : { ...(name ? { name } : {}), phone: phone ?? undefined };
    const request: ContactShareRequest = {
      profileId: values.profileId,
      channel: values.channel,
      recipient,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };

    send.mutate(request, {
      onSuccess: () => {
        const message = buildShareMessage({
          senderName: profile.displayName,
          recipientName: name || undefined,
          cardUrl: buildCardUrl(origin, profile.activeCardToken) ?? '',
          note: trimmedNote || undefined,
        });
        if (values.channel === 'whatsapp' && phone) {
          const url = buildWhatsAppUrl(phone, message);
          if (url) openExternal(url);
        } else if (values.channel === 'sms' && phone) {
          const url = buildSmsUrl(phone, message);
          if (url) openExternal(url);
        }
        toast.success(contactTexts.form.sent[values.channel]);
        form.reset({ profileId: values.profileId, channel: values.channel, recipientName: '', email: '', phone: '', note: '' });
        onSent?.();
      },
    });
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      {send.isError ? <Alert variant="error">{errorMessage(send.error)}</Alert> : null}

      <SelectField
        label={contactTexts.form.profileLabel}
        description={contactTexts.form.profileHint}
        required
        {...form.register('profileId')}
        error={validationMessage(form.formState.errors.profileId?.message)}
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.displayName}
          </option>
        ))}
      </SelectField>

      <SelectField label={contactTexts.form.channelLabel} required {...form.register('channel')}>
        {SHARE_CHANNELS.map((value) => (
          <option key={value} value={value}>
            {shareChannelLabels[value]}
          </option>
        ))}
      </SelectField>

      <TextField label={contactTexts.form.recipientNameLabel} {...form.register('recipientName')} />

      {channel === 'email' ? (
        <TextField
          label={contactTexts.form.emailLabel}
          type="email"
          inputMode="email"
          required
          placeholder="nome@empresa.co.mz"
          {...form.register('email')}
          error={validationMessage(form.formState.errors.email?.message)}
        />
      ) : (
        <TextField
          label={contactTexts.form.phoneLabel}
          description={contactTexts.form.phoneHint}
          type="tel"
          inputMode="tel"
          required
          placeholder={`${DEFAULT_PHONE_PREFIX} 84 123 4567`}
          {...form.register('phone')}
          error={validationMessage(form.formState.errors.phone?.message)}
        />
      )}

      <TextareaField
        label={contactTexts.form.noteLabel}
        description={contactTexts.form.noteHint}
        rows={3}
        {...form.register('note')}
        error={validationMessage(form.formState.errors.note?.message)}
      />

      {previewMessage ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{contactTexts.form.previewTitle}</span>
          <p className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm text-foreground">{previewMessage}</p>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={send.isPending}>
          {send.isPending ? <Spinner className="size-4" /> : null}
          {contactTexts.form.submit[channel]}
        </Button>
      </div>
    </form>
  );
}
