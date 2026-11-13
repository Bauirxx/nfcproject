import { zodResolver } from '@hookform/resolvers/zod';
import { MEMBER_ROLES } from '@nfc-business/shared/constants';
import { memberInviteRequestSchema } from '@nfc-business/shared/schemas';
import { useForm } from 'react-hook-form';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Dialog } from '@/shared/components/ui/dialog';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';
import { memberRoleLabels, memberTexts } from '@/shared/i18n/panel/members';
import { validationMessage } from '@/shared/i18n/validation';
import { useInviteMember } from './queries';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteMemberDialog({ open, onClose }: InviteMemberDialogProps) {
  const invite = useInviteMember();
  const form = useForm({
    resolver: zodResolver(memberInviteRequestSchema),
    defaultValues: { email: '', role: 'company_editor' as const },
  });

  function close() {
    form.reset();
    invite.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title={memberTexts.invite.title}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          invite.mutate(values, {
            onSuccess: () => {
              toast.success(memberTexts.invite.sent);
              close();
            },
          });
        })}
      >
        {invite.isError ? <Alert variant="error">{errorMessage(invite.error)}</Alert> : null}

        <TextField
          label={memberTexts.invite.emailLabel}
          type="email"
          required
          {...form.register('email')}
          error={validationMessage(form.formState.errors.email?.message)}
        />

        <SelectField label={memberTexts.invite.roleLabel} required {...form.register('role')}>
          {MEMBER_ROLES.map((role) => (
            <option key={role} value={role}>
              {memberRoleLabels[role]}
            </option>
          ))}
        </SelectField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={invite.isPending}>
            {commonTexts.actions.cancel}
          </Button>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? <Spinner className="size-4" /> : null}
            {memberTexts.invite.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
