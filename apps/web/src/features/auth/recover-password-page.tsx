import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { recoverRequestSchema, type RecoverRequest } from '@nfc-business/shared/schemas';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { apiFetch } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { authTexts } from '@/shared/i18n/panel/auth';
import { validationMessage } from '@/shared/i18n/validation';
import { AuthLayout } from './auth-layout';

export function RecoverPasswordPage() {
  const form = useForm({ resolver: zodResolver(recoverRequestSchema), defaultValues: { email: '' } });

  const recover = useMutation({
    // A resposta é sempre 202; nunca revela se a conta existe.
    mutationFn: (values: RecoverRequest) => apiFetch(endpoints.auth.recover, { method: 'POST', body: values }),
  });

  return (
    <AuthLayout title={authTexts.recover.title} subtitle={authTexts.recover.subtitle}>
      {recover.isSuccess ? (
        <div className="flex flex-col gap-4">
          <Alert variant="success">{authTexts.recover.sent}</Alert>
          <Link to="/entrar" className="text-center text-sm text-primary underline-offset-4 hover:underline">
            {authTexts.recover.backToLogin}
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((values) => recover.mutate(values))} className="flex flex-col gap-4">
          <TextField
            label={authTexts.fields.email}
            type="email"
            autoComplete="email"
            required
            {...form.register('email')}
            error={validationMessage(form.formState.errors.email?.message)}
          />
          <Button type="submit" disabled={recover.isPending}>
            {recover.isPending ? <Spinner className="size-4" /> : null}
            {authTexts.recover.submit}
          </Button>
          <Link to="/entrar" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            {authTexts.recover.backToLogin}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
