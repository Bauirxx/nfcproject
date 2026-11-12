import { zodResolver } from '@hookform/resolvers/zod';
import { cardLabelSchema } from '@nfc-business/shared/schemas';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Dialog } from '@/shared/components/ui/dialog';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';
import { cardTexts } from '@/shared/i18n/panel/cards';
import { validationMessage } from '@/shared/i18n/validation';
import { useCreateCard, useProfileOptionsQuery } from './queries';

// O select usa '' para «sem perfil»; convertido em `null` ao submeter.
const cardFormSchema = z.object({ label: cardLabelSchema, profileId: z.string() });

interface CardCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CardCreateDialog({ open, onClose }: CardCreateDialogProps) {
  const navigate = useNavigate();
  const profiles = useProfileOptionsQuery();
  const create = useCreateCard();
  const form = useForm({ resolver: zodResolver(cardFormSchema), defaultValues: { label: '', profileId: '' } });

  function close() {
    form.reset();
    create.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title={cardTexts.create.title}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          create.mutate(
            { label: values.label, profileId: values.profileId === '' ? null : values.profileId },
            { onSuccess: (card) => navigate(`/painel/cartoes/${card.id}`) },
          );
        })}
      >
        {create.isError ? <Alert variant="error">{errorMessage(create.error)}</Alert> : null}

        <TextField
          label={cardTexts.fields.label}
          description={cardTexts.fields.labelHint}
          required
          {...form.register('label')}
          error={validationMessage(form.formState.errors.label?.message)}
        />

        <SelectField label={cardTexts.fields.profile} {...form.register('profileId')}>
          <option value="">{cardTexts.fields.profileNone}</option>
          {(profiles.data ?? []).map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.displayName}
            </option>
          ))}
        </SelectField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={create.isPending}>
            {commonTexts.actions.cancel}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner className="size-4" /> : null}
            {cardTexts.create.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
