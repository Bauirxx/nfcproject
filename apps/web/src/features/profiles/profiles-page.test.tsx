import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

describe('ProfilesPage', () => {
  it('lista os perfis da empresa', async () => {
    renderApp({ route: '/painel/perfis', as: 'u_ana' });
    // O cargo é único por perfil (o nome repete-se na coluna do dono).
    expect(await screen.findByText('Gestora Comercial')).toBeInTheDocument();
    expect(screen.getByText('Atendimento ao cliente')).toBeInTheDocument();
    // Perfil de outra empresa não aparece.
    expect(screen.queryByText('Rita Cossa')).toBeNull();
  });

  it('procura por nome, cargo ou empresa', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/perfis', as: 'u_ana' });
    await screen.findByText('Gestora Comercial');

    await user.type(screen.getByLabelText('Procurar perfis'), 'técnico');

    // A pesquisa é adiada; espera que o perfil que não corresponde saia da lista.
    await waitFor(() => expect(screen.queryByText('Gestora Comercial')).toBeNull());
    expect(screen.getByText('Técnico Comercial')).toBeInTheDocument();
  });

  it('o dono de perfil só vê o seu perfil e não pode criar', async () => {
    renderApp({ route: '/painel/perfis', as: 'u_paula' });
    await screen.findByText('Gestora Comercial');
    expect(screen.queryByText('Técnico Comercial')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Criar perfil' })).toBeNull();
  });

  it('cria um perfil e abre o editor', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/perfis', as: 'u_ana' });

    await user.click(await screen.findByRole('button', { name: 'Criar perfil' }));
    await user.type(await screen.findByLabelText('Nome do perfil'), 'Nuno Ngoenha');
    await user.click(screen.getByRole('button', { name: 'Criar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Nuno Ngoenha' })).toBeInTheDocument();
  });
});
