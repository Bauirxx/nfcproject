import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '@/mocks/credentials';
import { renderApp } from '@/test/utils';

describe('ResetPasswordPage', () => {
  it('define uma nova palavra-passe com um link válido', async () => {
    const user = userEvent.setup();
    renderApp({ route: `/definir-password?token=${MOCK_TOKENS.reset}` });

    await user.type(await screen.findByLabelText('Nova palavra-passe'), 'NovaPass#2026');
    await user.type(screen.getByLabelText('Confirmar a palavra-passe'), 'NovaPass#2026');
    await user.click(screen.getByRole('button', { name: 'Guardar a palavra-passe' }));

    expect(await screen.findByText(/Palavra-passe alterada/)).toBeInTheDocument();
  });

  it('avisa quando o link não traz código', async () => {
    renderApp({ route: '/definir-password' });
    expect(await screen.findByText(/Falta o código do link/)).toBeInTheDocument();
  });

  it('não submete se as palavras-passe não coincidirem', async () => {
    const user = userEvent.setup();
    renderApp({ route: `/definir-password?token=${MOCK_TOKENS.reset}` });

    await user.type(await screen.findByLabelText('Nova palavra-passe'), 'NovaPass#2026');
    await user.type(screen.getByLabelText('Confirmar a palavra-passe'), 'OutraPass#2026');
    await user.click(screen.getByRole('button', { name: 'Guardar a palavra-passe' }));

    expect(await screen.findByText(/palavras-passe não são iguais/)).toBeInTheDocument();
  });
});
