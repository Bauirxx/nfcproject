import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '@/mocks/credentials';
import { renderApp } from '@/test/utils';

async function fillLogin(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Palavra-passe'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  it('entra sem MFA e vai para o painel', async () => {
    renderApp({ route: '/entrar' });
    await fillLogin(MOCK_USERS.owner.email, MOCK_USERS.owner.password);

    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
  });

  it('mostra uma mensagem genérica com credenciais erradas', async () => {
    renderApp({ route: '/entrar' });
    await fillLogin(MOCK_USERS.owner.email, 'palavra-passe-errada');

    expect(await screen.findByText('Email ou palavra-passe incorretos.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  });

  it('encaminha para a verificação em dois passos quando a conta tem MFA', async () => {
    renderApp({ route: '/entrar' });
    await fillLogin(MOCK_USERS.companyAdmin.email, MOCK_USERS.companyAdmin.password);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Verificação em dois passos' }),
    ).toBeInTheDocument();
  });
});
