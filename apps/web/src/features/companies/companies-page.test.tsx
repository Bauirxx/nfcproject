import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

describe('CompaniesPage', () => {
  it('lista as empresas com contagens para o platform_admin', async () => {
    renderApp({ route: '/painel/empresas', as: 'u_marta' });
    expect(await screen.findByText('Acme Moçambique')).toBeInTheDocument();
    expect(screen.getByText('Beta Logística')).toBeInTheDocument();
  });

  it('nega o acesso a quem não é platform_admin', async () => {
    renderApp({ route: '/painel/empresas', as: 'u_ana' });
    // O guard de permissão mostra a página 403 «Sem permissão».
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByText('Acme Moçambique')).toBeNull();
  });
});

describe('CompanyFormPage', () => {
  it('cria uma empresa e volta à lista', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/empresas/nova', as: 'u_marta' });

    await user.type(await screen.findByLabelText('Nome da empresa'), 'Gama Serviços');
    await user.type(screen.getByLabelText('Email de contacto'), 'geral@gama.test');
    await user.type(screen.getByLabelText('Email do administrador'), 'admin@gama.test');
    await user.click(screen.getByRole('button', { name: 'Criar empresa' }));

    expect(await screen.findByText('Gama Serviços')).toBeInTheDocument();
  });

  it('mostra o erro do contrato quando o email do administrador já tem conta', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/empresas/nova', as: 'u_marta' });

    await user.type(await screen.findByLabelText('Nome da empresa'), 'Delta');
    await user.type(screen.getByLabelText('Email de contacto'), 'geral@delta.test');
    await user.type(screen.getByLabelText('Email do administrador'), 'ana.admin@acme.test');
    await user.click(screen.getByRole('button', { name: 'Criar empresa' }));

    expect(await screen.findByText(/Já existe um membro ou convite com este email\./)).toBeInTheDocument();
  });

  it('carrega e edita uma empresa existente', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/empresas/co_beta', as: 'u_marta' });

    const name = await screen.findByLabelText('Nome da empresa');
    expect(name).toHaveValue('Beta Logística');
    // O email do administrador não aparece na edição.
    expect(screen.queryByLabelText('Email do administrador')).toBeNull();

    await user.clear(name);
    await user.type(name, 'Beta Logística, Lda.');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    expect(await screen.findByText('Beta Logística, Lda.')).toBeInTheDocument();
  });
});
