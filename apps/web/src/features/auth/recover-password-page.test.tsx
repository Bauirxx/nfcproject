import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

describe('RecoverPasswordPage', () => {
  it('mostra sempre a mesma mensagem, exista ou não a conta', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/recuperar-password' });

    await user.type(await screen.findByLabelText('Email'), 'desconhecido@exemplo.test');
    await user.click(screen.getByRole('button', { name: 'Enviar o link' }));

    expect(await screen.findByText(/Se existir uma conta com este email/)).toBeInTheDocument();
  });
});
