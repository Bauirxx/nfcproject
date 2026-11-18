import { zodResolver } from '@hookform/resolvers/zod';
import {
  accountUpdateRequestSchema,
  mfaDisableRequestSchema,
  passwordSchema,
  type SessionUser,
} from '@nfc-business/shared/schemas';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { useCurrentUser } from '@/app/session';
import { Alert } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Dialog } from '@/shared/components/ui/dialog';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { PasswordField } from '@/shared/components/ui/password-field';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';
import { formatDateTime } from '@/shared/i18n/format';
import { accountTexts, roleLabels } from '@/shared/i18n/panel/account';
import { authTexts } from '@/shared/i18n/panel/auth';
import { commonTexts } from '@/shared/i18n/panel/common';
import { validationMessage } from '@/shared/i18n/validation';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useChangePassword, useDisableMfa, useEndAllSessions, useSessionsQuery, useUpdateAccount } from './queries';

// A confirmação da nova palavra-passe só existe no formulário (o pedido à API não a tem).
const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'required'),
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({ code: 'custom', message: 'password_mismatch', path: ['confirmPassword'] });
    }
  });

export function AccountPage() {
  useDocumentTitle(accountTexts.title);
  const user = useCurrentUser();

  if (!user) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8" label={commonTexts.states.loading} />
      </div>
    );
  }

  return (
    <section className="max-w-2xl">
      <PageHeader title={accountTexts.title} description={accountTexts.description} />
      <div className="flex flex-col gap-6">
        <DetailsSection user={user} />
        <PasswordSection />
        <MfaSection user={user} />
        <SessionsSection />
      </div>
    </section>
  );
}

function DetailsSection({ user }: { user: SessionUser }) {
  const update = useUpdateAccount();
  const form = useForm({ resolver: zodResolver(accountUpdateRequestSchema), defaultValues: { name: user.name } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{accountTexts.details.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) =>
            update.mutate(values, { onSuccess: () => toast.success(accountTexts.details.saved) }),
          )}
        >
          {update.isError ? <Alert variant="error">{errorMessage(update.error)}</Alert> : null}
          <TextField
            label={accountTexts.details.name}
            required
            {...form.register('name')}
            error={validationMessage(form.formState.errors.name?.message)}
          />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{accountTexts.details.email}</dt>
              <dd className="font-medium break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{accountTexts.details.role}</dt>
              <dd className="font-medium">{roleLabels[user.role]}</dd>
            </div>
            {user.companyName ? (
              <div>
                <dt className="text-muted-foreground">{accountTexts.details.company}</dt>
                <dd className="font-medium">{user.companyName}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-xs text-muted-foreground">{accountTexts.details.emailHint}</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? <Spinner className="size-4" /> : null}
              {accountTexts.details.submit}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const change = useChangePassword();
  const form = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{accountTexts.password.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) =>
            change.mutate(
              { currentPassword: values.currentPassword, newPassword: values.newPassword },
              {
                onSuccess: () => {
                  toast.success(accountTexts.password.saved);
                  form.reset();
                },
              },
            ),
          )}
        >
          {change.isError ? <Alert variant="error">{errorMessage(change.error)}</Alert> : null}
          <PasswordField
            label={accountTexts.password.current}
            required
            autoComplete="current-password"
            {...form.register('currentPassword')}
            error={validationMessage(errors.currentPassword?.message)}
          />
          <PasswordField
            label={accountTexts.password.next}
            required
            autoComplete="new-password"
            description={authTexts.passwordHint}
            {...form.register('newPassword')}
            error={validationMessage(errors.newPassword?.message)}
          />
          <PasswordField
            label={accountTexts.password.confirm}
            required
            autoComplete="new-password"
            {...form.register('confirmPassword')}
            error={validationMessage(errors.confirmPassword?.message)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? <Spinner className="size-4" /> : null}
              {accountTexts.password.submit}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MfaSection({ user }: { user: SessionUser }) {
  const [disableOpen, setDisableOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {user.mfaEnabled ? (
            <ShieldCheck aria-hidden="true" className="size-5 text-success" />
          ) : (
            <ShieldOff aria-hidden="true" className="size-5 text-warning" />
          )}
          {accountTexts.mfa.title}
        </CardTitle>
        <CardDescription>{user.mfaEnabled ? accountTexts.mfa.enabled : accountTexts.mfa.disabled}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!user.mfaEnabled ? (
          <Button asChild className="self-start">
            <Link to="/configurar-mfa">{accountTexts.mfa.enable}</Link>
          </Button>
        ) : user.mfaRequired ? (
          <p className="text-sm text-muted-foreground">{accountTexts.mfa.required}</p>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setDisableOpen(true)}>
            {accountTexts.mfa.disable}
          </Button>
        )}
      </CardContent>
      {disableOpen ? <DisableMfaDialog onClose={() => setDisableOpen(false)} /> : null}
    </Card>
  );
}

function DisableMfaDialog({ onClose }: { onClose: () => void }) {
  const disable = useDisableMfa();
  const form = useForm({ resolver: zodResolver(mfaDisableRequestSchema), defaultValues: { password: '' } });

  return (
    <Dialog open onClose={onClose} title={accountTexts.mfa.disableTitle} description={accountTexts.mfa.disableBody}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          disable.mutate(values, {
            onSuccess: () => {
              toast.success(accountTexts.mfa.disabledOk);
              onClose();
            },
          }),
        )}
      >
        {disable.isError ? <Alert variant="error">{errorMessage(disable.error)}</Alert> : null}
        <PasswordField
          label={accountTexts.mfa.disablePassword}
          required
          autoComplete="current-password"
          {...form.register('password')}
          error={validationMessage(form.formState.errors.password?.message)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={disable.isPending}>
            {commonTexts.actions.cancel}
          </Button>
          <Button type="submit" variant="destructive" disabled={disable.isPending}>
            {disable.isPending ? <Spinner className="size-4" /> : null}
            {accountTexts.mfa.disable}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function SessionsSection() {
  const sessions = useSessionsQuery();
  const endAll = useEndAllSessions();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{accountTexts.sessions.title}</CardTitle>
        <CardDescription>{accountTexts.sessions.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sessions.isPending ? (
          <Spinner className="size-5" label={commonTexts.states.loading} />
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : sessions.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{accountTexts.sessions.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {sessions.data.items.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex flex-col">
                  <span className="font-medium">{session.device}</span>
                  <span className="text-xs text-muted-foreground">
                    {accountTexts.sessions.lastSeen(formatDateTime(session.lastSeenAt))}
                  </span>
                </div>
                {session.current ? <Badge variant="info">{accountTexts.sessions.current}</Badge> : null}
              </li>
            ))}
          </ul>
        )}
        <Button variant="destructive" className="self-start" onClick={() => setConfirmOpen(true)}>
          {accountTexts.sessions.endAll}
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => endAll.mutate()}
        title={accountTexts.sessions.endAllTitle}
        description={accountTexts.sessions.endAllBody}
        confirmLabel={accountTexts.sessions.endAllConfirm}
        destructive
        loading={endAll.isPending}
      />
    </Card>
  );
}
