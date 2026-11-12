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
import { errorMessage } from '@/shared/i18n/errors';
import { authTexts } from '@/shared/i18n/panel/auth';
import { validationMessage } from '@/shared/i18n/validation';
import { AuthLayout } from './auth-layout';
import { resetPasswordFormSchema, type ResetPasswordForm } from './schemas';
import { useUrlToken } from './use-url-token';

export function ResetPasswordPage() {
  const token = useUrlToken();
  const form = useForm({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const reset = useMutation({
    meta: { inlineError: true },
    mutationFn: (values: ResetPasswordForm) =>
      apiFetch(endpoints.auth.recoverConfirm, { method: 'POST', body: { token, password: values.password } }),
  });

  const goToLogin = (
    <Button asChild className="w-full">
      <Link to="/entrar">{authTexts.reset.goToLogin}</Link>
    </Button>
  );

  return (
    <AuthLayout title={authTexts.reset.title} subtitle={authTexts.reset.subtitle}>
      {token === null ? (
        <div className="flex flex-col gap-4">
          <Alert variant="error">{authTexts.errors.missingToken}</Alert>
          {goToLogin}
        </div>
      ) : reset.isSuccess ? (
        <div className="flex flex-col gap-4">
          <Alert variant="success">{authTexts.reset.done}</Alert>
          {goToLogin}
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((values) => reset.mutate(values))} className="flex flex-col gap-4">
          {reset.isError ? <Alert variant="error">{errorMessage(reset.error)}</Alert> : null}
          <PasswordField
            label={authTexts.fields.newPassword}
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
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending ? <Spinner className="size-4" /> : null}
            {authTexts.reset.submit}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
