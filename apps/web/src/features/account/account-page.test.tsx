import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '@/mocks/credentials';
import { renderApp } from '@/test/utils';

describe('AccountPage', () => {
  it('mostra os dados da conta e guarda o nome', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/conta', as: 'u_paula' });

    const name = await screen.findByLabelText('Nome');
    expect(name).toHaveValue('Paula Machava');
    expect(screen.getByText('paula.owner@acme.test')).toBeInTheDocument();
    // O papel aparece nos dados da conta (e também no menu do utilizador).
    expect(screen.getAllByText('Dono de perfil').length).toBeGreaterThan(0);

    await user.clear(name);
    await user.type(name, 'Paula M. Machava');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Dados guardados.')).toBeInTheDocument();
  });

  it('recusa a alteração com a palavra-passe atual errada', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/conta', as: 'u_paula' });

    await user.type(await screen.findByLabelText('Palavra-passe atual'), 'Errada#2026okay');
    await user.type(screen.getByLabelText('Nova palavra-passe'), 'NovaPalavra#2026');
    await user.type(screen.getByLabelText('Confirmar a nova palavra-passe'), 'NovaPalavra#2026');
    await user.click(screen.getByRole('button', { name: 'Alterar a palavra-passe' }));

    expect(await screen.findByText('A palavra-passe atual não está correta.')).toBeInTheDocument();
  });

  it('valida a confirmação e altera a palavra-passe', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/conta', as: 'u_paula' });

    await user.type(await screen.findByLabelText('Palavra-passe atual'), MOCK_USERS.owner.password);
    await user.type(screen.getByLabelText('Nova palavra-passe'), 'NovaPalavra#2026');
    await user.type(screen.getByLabelText('Confirmar a nova palavra-passe'), 'Diferente#2026xx');
    await user.click(screen.getByRole('button', { name: 'Alterar a palavra-passe' }));
    expect(await screen.findByText('As duas palavras-passe não são iguais.')).toBeInTheDocument();

    const confirm = screen.getByLabelText('Confirmar a nova palavra-passe');
    await user.clear(confirm);
    await user.type(confirm, 'NovaPalavra#2026');
    await user.click(screen.getByRole('button', { name: 'Alterar a palavra-passe' }));
    expect(await screen.findByText('Palavra-passe alterada.')).toBeInTheDocument();
  });

  it('mostra o estado da verificação em dois passos conforme o papel', async () => {
    renderApp({ route: '/painel/conta', as: 'u_paula' });
    expect(await screen.findByRole('link', { name: 'Ativar a verificação em dois passos' })).toHaveAttribute(
      'href',
      '/configurar-mfa',
    );

    renderApp({ route: '/painel/conta', as: 'u_ana' });
    expect(await screen.findByText('Obrigatória para o seu papel; não pode ser desativada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
  });

  it('lista as sessões e termina todas, voltando ao login', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/conta', as: 'u_paula' });

    expect(await screen.findByText('Chrome em Android')).toBeInTheDocument();
    expect(screen.getByText('Esta sessão')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Terminar todas as sessões' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Terminar todas' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
