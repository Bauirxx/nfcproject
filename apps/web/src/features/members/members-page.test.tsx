import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

function rowOf(email: string): HTMLElement {
  const cell = screen.getByText(email);
  const row = cell.closest('tr');
  if (!row) throw new Error(`linha não encontrada para ${email}`);
  return row;
}

describe('MembersPage', () => {
  it('lista os membros da empresa do company_admin', async () => {
    renderApp({ route: '/painel/membros', as: 'u_ana' });
    expect(await screen.findByText('edu.editor@acme.test')).toBeInTheDocument();
    expect(screen.getByText('paula.owner@acme.test')).toBeInTheDocument();
    // Membro de outra empresa não aparece.
    expect(screen.queryByText('rita.owner@beta.test')).toBeNull();
  });

  it('nega o acesso a quem não gere membros', async () => {
    renderApp({ route: '/painel/membros', as: 'u_edu' });
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
  });

  it('não deixa o próprio mudar o seu papel nem remover-se', async () => {
    renderApp({ route: '/painel/membros', as: 'u_ana' });
    await screen.findByText('ana.admin@acme.test');
    const selfRow = rowOf('ana.admin@acme.test');
    expect(within(selfRow).getByRole('combobox')).toBeDisabled();
    expect(within(selfRow).getByRole('button', { name: 'Remover' })).toBeDisabled();
  });

  it('muda o papel de outro membro', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/membros', as: 'u_ana' });
    await screen.findByText('edu.editor@acme.test');

    const row = rowOf('edu.editor@acme.test');
    await user.selectOptions(within(row).getByRole('combobox'), 'company_admin');

    expect(await screen.findByText('Papel atualizado.')).toBeInTheDocument();
  });

  it('convida um novo membro', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/membros', as: 'u_ana' });
    await screen.findByText('edu.editor@acme.test');

    await user.click(screen.getByRole('button', { name: 'Convidar membro' }));
    await user.type(await screen.findByLabelText('Email'), 'nova.pessoa@acme.test');
    await user.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('nova.pessoa@acme.test')).toBeInTheDocument();
  });

  it('remove um membro após confirmação', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/membros', as: 'u_ana' });
    await screen.findByText('carlos.owner@acme.test');

    const row = rowOf('carlos.owner@acme.test');
    await user.click(within(row).getByRole('button', { name: 'Remover' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText('Membro removido.')).toBeInTheDocument();
    expect(screen.queryByText('carlos.owner@acme.test')).toBeNull();
  });
});
