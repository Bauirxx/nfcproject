import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_RECOVERY_CODES, MOCK_USERS } from '@/mocks/credentials';
import { generateTotp } from '@/mocks/totp';
import { renderApp } from '@/test/utils';

async function loginWithMfa() {
  const user = userEvent.setup();
  renderApp({ route: '/entrar' });
  await user.type(await screen.findByLabelText('Email'), MOCK_USERS.companyAdmin.email);
  await user.type(screen.getByLabelText('Palavra-passe'), MOCK_USERS.companyAdmin.password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('heading', { level: 1, name: 'Verificação em dois passos' });
  return user;
}

describe('MfaVerifyPage', () => {
  it('conclui o login com um código TOTP válido', async () => {
    const user = await loginWithMfa();
    const secret = MOCK_USERS.companyAdmin.totpSecret;
    if (!secret) throw new Error('conta de teste sem TOTP');

    await user.type(screen.getByLabelText('Código de verificação'), await generateTotp(secret));
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
  });

  it('recusa um código errado com mensagem genérica', async () => {
    const user = await loginWithMfa();

    await user.type(screen.getByLabelText('Código de verificação'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByText(/código não está correto/i)).toBeInTheDocument();
  });

  it('aceita um código de recuperação', async () => {
    const user = await loginWithMfa();

    await user.click(screen.getByRole('button', { name: 'Usar um código de recuperação' }));
    await user.type(screen.getByLabelText('Código de recuperação'), MOCK_RECOVERY_CODES.companyAdmin);
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
  });
});
