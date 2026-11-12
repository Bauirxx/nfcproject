import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loginRequestSchema, loginResponseSchema, type LoginRequest } from '@nfc-business/shared/schemas';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { sessionQueryKey } from '@/app/session-events';
import { endpoints } from '@/shared/api/endpoints';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { PasswordField } from '@/shared/components/ui/password-field';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { errorMessage } from '@/shared/i18n/errors';
import { authTexts } from '@/shared/i18n/panel/auth';
import { validationMessage } from '@/shared/i18n/validation';
import { apiParsed } from '@/shared/lib/parsed-api';
import { AuthLayout } from './auth-layout';
import { redirectTarget, type FromState } from './from-state';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = location.state as FromState;

  const form = useForm({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    meta: { inlineError: true },
    mutationFn: (values: LoginRequest) =>
      apiParsed(loginResponseSchema, endpoints.auth.login, { method: 'POST', body: values }),
    onSuccess: (data) => {
      if (data.status === 'mfa_required') {
        navigate('/entrar/mfa', { state: from });
        return;
      }
      queryClient.setQueryData(sessionQueryKey, data.user);
      navigate(redirectTarget(from), { replace: true });
    },
  });

  return (
    <AuthLayout title={authTexts.login.title} subtitle={authTexts.login.subtitle}>
      <form noValidate onSubmit={form.handleSubmit((values) => login.mutate(values))} className="flex flex-col gap-4">
        {login.isError ? <Alert variant="error">{errorMessage(login.error)}</Alert> : null}

        <TextField
          label={authTexts.fields.email}
          type="email"
          autoComplete="email"
          required
          {...form.register('email')}
          error={validationMessage(form.formState.errors.email?.message)}
        />
        <PasswordField
          label={authTexts.fields.password}
          autoComplete="current-password"
          required
          {...form.register('password')}
          error={validationMessage(form.formState.errors.password?.message)}
        />

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? <Spinner className="size-4" /> : null}
          {authTexts.login.submit}
        </Button>

        <Link
          to="/recuperar-password"
          className="text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          {authTexts.login.forgot}
        </Link>
      </form>
    </AuthLayout>
  );
}
