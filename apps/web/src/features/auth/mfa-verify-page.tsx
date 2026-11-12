import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mfaVerifyResponseSchema } from '@nfc-business/shared/schemas';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { sessionQueryKey } from '@/app/session-events';
import { endpoints } from '@/shared/api/endpoints';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { errorMessage } from '@/shared/i18n/errors';
import { authTexts } from '@/shared/i18n/panel/auth';
import { apiParsed } from '@/shared/lib/parsed-api';
import { AuthLayout } from './auth-layout';
import { redirectTarget, type FromState } from './from-state';

type Mode = 'totp' | 'recovery';

export function MfaVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('totp');
  const [value, setValue] = useState('');

  const verify = useMutation({
    meta: { inlineError: true },
    mutationFn: () => {
      const trimmed = value.trim();
      const body = mode === 'totp' ? { code: trimmed } : { recoveryCode: trimmed.toUpperCase() };
      return apiParsed(mfaVerifyResponseSchema, endpoints.auth.mfaVerify, { method: 'POST', body });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryKey, data.user);
      navigate(redirectTarget(location.state as FromState), { replace: true });
    },
  });

  function switchMode(next: Mode) {
    setMode(next);
    setValue('');
  }

  return (
    <AuthLayout
      title={authTexts.mfaVerify.title}
      subtitle={mode === 'totp' ? authTexts.mfaVerify.subtitle : authTexts.mfaVerify.recoveryHint}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim() !== '') verify.mutate();
        }}
        className="flex flex-col gap-4"
      >
        {verify.isError ? <Alert variant="error">{errorMessage(verify.error)}</Alert> : null}

        {mode === 'totp' ? (
          <TextField
            label={authTexts.fields.code}
            description={authTexts.mfaVerify.codeHint}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <TextField
            label={authTexts.fields.recoveryCode}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        <Button type="submit" disabled={verify.isPending || value.trim() === ''}>
          {verify.isPending ? <Spinner className="size-4" /> : null}
          {authTexts.mfaVerify.submit}
        </Button>

        <Button
          type="button"
          variant="link"
          onClick={() => switchMode(mode === 'totp' ? 'recovery' : 'totp')}
        >
          {mode === 'totp' ? authTexts.mfaVerify.useRecovery : authTexts.mfaVerify.useTotp}
        </Button>

        <Link to="/entrar" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          {authTexts.mfaVerify.back}
        </Link>
      </form>
    </AuthLayout>
  );
}
