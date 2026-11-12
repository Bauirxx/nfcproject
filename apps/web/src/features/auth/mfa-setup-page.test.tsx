import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/mocks/db';
import { generateTotp } from '@/mocks/totp';
import { renderApp } from '@/test/utils';

describe('MfaSetupPage', () => {
  it('ativa o MFA, mostra os códigos de recuperação e entra no painel', async () => {
    const user = userEvent.setup();
    // Nelson é administrador de empresa sem MFA: o guard força esta página.
    renderApp({ route: '/configurar-mfa', as: 'u_nelson' });

    // O QR aparece quando a chave é gerada no servidor simulado.
    await screen.findByRole('img');
    const secret = getDb().users.find((candidate) => candidate.id === 'u_nelson')?.pendingTotpSecret;
    if (!secret) throw new Error('a configuração de MFA não gerou chave');

    await user.type(screen.getByLabelText('Código de verificação'), await generateTotp(secret));
    await user.click(screen.getByRole('button', { name: 'Ativar' }));

    // Códigos de recuperação mostrados uma única vez.
    expect(await screen.findByRole('heading', { level: 1, name: /Guarde os seus códigos/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Já guardei os códigos' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
  });
});
