import { zodResolver } from '@hookform/resolvers/zod';
import { personNameSchema } from '@nfc-business/shared/schemas';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { usePermission } from '@/app/session';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Dialog } from '@/shared/components/ui/dialog';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';
import { profileTexts } from '@/shared/i18n/panel/profiles';
import { validationMessage } from '@/shared/i18n/validation';
import { useCompanyMembersQuery, useCreateProfile } from './queries';

// O select usa '' para «sem dono»; convertido em `undefined` ao submeter (não enviar sem permissão).
const createFormSchema = z.object({ displayName: personNameSchema, ownerUserId: z.string() });

interface ProfileCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileCreateDialog({ open, onClose }: ProfileCreateDialogProps) {
  const navigate = useNavigate();
  const canAssignOwner = usePermission('profiles.assignOwner');
  const members = useCompanyMembersQuery(open && canAssignOwner);
  const create = useCreateProfile();
  const form = useForm({ resolver: zodResolver(createFormSchema), defaultValues: { displayName: '', ownerUserId: '' } });

  function close() {
    form.reset();
    create.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title={profileTexts.create.title}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          create.mutate(
            {
              displayName: values.displayName,
              ...(canAssignOwner && values.ownerUserId !== '' ? { ownerUserId: values.ownerUserId } : {}),
            },
            { onSuccess: (profile) => navigate(`/painel/perfis/${profile.id}`) },
          );
        })}
      >
        {create.isError ? <Alert variant="error">{errorMessage(create.error)}</Alert> : null}

        <TextField
          label={profileTexts.create.nameLabel}
          description={profileTexts.create.nameHint}
          required
          {...form.register('displayName')}
          error={validationMessage(form.formState.errors.displayName?.message)}
        />

        {canAssignOwner ? (
          <SelectField
            label={profileTexts.create.ownerLabel}
            description={profileTexts.create.ownerHint}
            {...form.register('ownerUserId')}
          >
            <option value="">{profileTexts.create.ownerNone}</option>
            {(members.data?.items ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.name ?? member.email}
              </option>
            ))}
          </SelectField>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={create.isPending}>
            {commonTexts.actions.cancel}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner className="size-4" /> : null}
            {profileTexts.create.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
