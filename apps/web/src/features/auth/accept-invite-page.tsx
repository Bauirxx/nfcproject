import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { PasswordField } from '@/shared/components/ui/password-field';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { errorMessage } from '@/shared/i18n/errors';
import { authTexts } from '@/shared/i18n/panel/auth';
import { validationMessage } from '@/shared/i18n/validation';
import { AuthLayout } from './auth-layout';
import { inviteFormSchema, type InviteForm } from './schemas';
import { useUrlToken } from './use-url-token';

export function AcceptInvitePage() {
  const token = useUrlToken();
  const form = useForm({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { name: '', password: '', confirmPassword: '' },
  });

  // O convite não inicia sessão: no fim, o utilizador inicia sessão com as novas credenciais.
  const accept = useMutation({
    meta: { inlineError: true },
    mutationFn: (values: InviteForm) =>
      apiFetch(endpoints.auth.inviteAccept, { method: 'POST', body: { token, name: values.name, password: values.password } }),
  });

  const goToLogin = (
    <Button asChild className="w-full">
      <Link to="/entrar">{authTexts.invite.goToLogin}</Link>
    </Button>
  );

  return (
    <AuthLayout title={authTexts.invite.title} subtitle={authTexts.invite.subtitle}>
      {token === null ? (
        <div className="flex flex-col gap-4">
          <Alert variant="error">{authTexts.invite.invalidLink}</Alert>
          {goToLogin}
        </div>
      ) : accept.isSuccess ? (
        <div className="flex flex-col gap-4">
          <Alert variant="success">{authTexts.invite.done}</Alert>
          {goToLogin}
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((values) => accept.mutate(values))} className="flex flex-col gap-4">
          {accept.isError ? <Alert variant="error">{errorMessage(accept.error)}</Alert> : null}
          <TextField
            label={authTexts.fields.name}
            autoComplete="name"
            required
            {...form.register('name')}
            error={validationMessage(form.formState.errors.name?.message)}
          />
          <PasswordField
            label={authTexts.fields.password}
            description={authTexts.passwordHint}
            autoComplete="new-password"
            required
            {...form.register('password')}
            error={validationMessage(form.formState.errors.password?.message)}
          />
          <PasswordField
            label={authTexts.fields.confirmPassword}
            autoComplete="new-password"
            required
            {...form.register('confirmPassword')}
            error={validationMessage(form.formState.errors.confirmPassword?.message)}
          />
          <Button type="submit" disabled={accept.isPending}>
            {accept.isPending ? <Spinner className="size-4" /> : null}
            {authTexts.invite.submit}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
