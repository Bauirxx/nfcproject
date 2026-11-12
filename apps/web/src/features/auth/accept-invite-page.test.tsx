import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '@/mocks/credentials';
import { renderApp } from '@/test/utils';

describe('AcceptInvitePage', () => {
  it('cria a conta a partir de um convite válido', async () => {
    const user = userEvent.setup();
    renderApp({ route: `/convite?token=${MOCK_TOKENS.invite}` });

    await user.type(await screen.findByLabelText('Nome'), 'Convidado Teste');
    await user.type(screen.getByLabelText('Palavra-passe'), 'MinhaPass#2026');
    await user.type(screen.getByLabelText('Confirmar a palavra-passe'), 'MinhaPass#2026');
    await user.click(screen.getByRole('button', { name: 'Criar a conta' }));

    expect(await screen.findByText(/Conta criada/)).toBeInTheDocument();
  });

  it('avisa quando o convite não traz código', async () => {
    renderApp({ route: '/convite' });
    expect(await screen.findByText(/convite não é válido/)).toBeInTheDocument();
  });
});
