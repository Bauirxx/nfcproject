import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mfaConfirmResponseSchema, mfaSetupResponseSchema, type SessionUser } from '@nfc-business/shared/schemas';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { sessionQueryKey } from '@/app/session-events';
import { useSignOut } from '@/app/use-sign-out';
import { endpoints } from '@/shared/api/endpoints';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { QrCode } from '@/shared/components/ui/qr-code';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';
import { authTexts } from '@/shared/i18n/panel/auth';
import { apiParsed } from '@/shared/lib/parsed-api';
import { AuthLayout } from './auth-layout';

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Sem permissão de área de transferência: o utilizador copia manualmente.
  }
}

export function MfaSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[] | null>(null);

  const setup = useQuery({
    queryKey: ['mfa-setup'],
    queryFn: () => apiParsed(mfaSetupResponseSchema, endpoints.auth.mfaSetup, { method: 'POST' }),
    staleTime: Infinity,
    retry: false,
  });

  const confirm = useMutation({
    meta: { inlineError: true },
    mutationFn: () => apiParsed(mfaConfirmResponseSchema, endpoints.auth.mfaConfirm, { method: 'POST', body: { code: code.trim() } }),
    onSuccess: (data) => setRecoveryCodes(data.recoveryCodes),
  });

  function finish() {
    // A conta passa a ter MFA; atualiza a sessão em cache para o guard deixar entrar no painel.
    queryClient.setQueryData<SessionUser | null>(sessionQueryKey, (current) =>
      current ? { ...current, mfaEnabled: true } : current,
    );
    navigate('/painel', { replace: true });
  }

  if (recoveryCodes) {
    return (
      <AuthLayout title={authTexts.mfaSetup.recoveryTitle}>
        <div className="flex flex-col gap-4">
          <Alert variant="warning">{authTexts.mfaSetup.recoveryBody}</Alert>
          <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode}>{recoveryCode}</li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => copyToClipboard(recoveryCodes.join('\n'))}>
            <Copy aria-hidden="true" />
            {commonTexts.actions.copy}
          </Button>
          <Button onClick={finish}>{authTexts.mfaSetup.recoveryConfirm}</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={authTexts.mfaSetup.title} subtitle={authTexts.mfaSetup.subtitle}>
      {setup.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-8" label={commonTexts.states.loading} />
        </div>
      ) : setup.isError ? (
        <div className="flex flex-col gap-4">
          <Alert variant="error">{errorMessage(setup.error)}</Alert>
          <Button variant="outline" onClick={() => setup.refetch()}>
            {commonTexts.actions.retry}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">{authTexts.mfaSetup.scanHint}</p>
          <QrCode value={setup.data.otpauthUrl} title={authTexts.mfaSetup.title} className="mx-auto h-48 w-48" />

          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">{authTexts.mfaSetup.secretLabel}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {setup.data.secret}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label={commonTexts.actions.copy}
                onClick={() => copyToClipboard(setup.data.secret)}
              >
                <Copy aria-hidden="true" />
              </Button>
            </div>
          </div>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim() !== '') confirm.mutate();
            }}
            className="flex flex-col gap-4"
          >
            {confirm.isError ? <Alert variant="error">{errorMessage(confirm.error)}</Alert> : null}
            <TextField
              label={authTexts.fields.code}
              description={authTexts.mfaSetup.confirmHint}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" disabled={confirm.isPending || code.trim() === ''}>
              {confirm.isPending ? <Spinner className="size-4" /> : null}
              {authTexts.mfaSetup.submit}
            </Button>
          </form>

          <Button variant="link" onClick={() => signOut.mutate()}>
            {authTexts.mfaVerify.back}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
