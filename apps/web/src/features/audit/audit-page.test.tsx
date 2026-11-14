import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

describe('AuditPage', () => {
  it('mostra os registos de auditoria da empresa', async () => {
    renderApp({ route: '/painel/auditoria', as: 'u_ana' });
    await screen.findByRole('heading', { level: 1, name: 'Auditoria' });

    // Ação registada nos dados de demonstração da Acme.
    expect(await screen.findByText('Stock 022')).toBeInTheDocument();
  });

  it('filtra por ação', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/auditoria', as: 'u_ana' });
    await screen.findByText('Stock 022');

    await user.selectOptions(screen.getByLabelText('Ação'), 'member.invited');

    expect((await screen.findAllByText('convidado@acme.test')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText('Stock 022')).toBeNull());
  });

  it('filtra por autor', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/auditoria', as: 'u_marta' });
    await screen.findByText('Marta Nhaca');

    await user.type(screen.getByLabelText('Autor'), 'nelson');

    // «Marta Nhaca» também surge no rodapé da barra lateral (utilizador com sessão): restringir à tabela.
    const table = screen.getByRole('table');
    expect((await within(table).findAllByText('Nelson Tembe')).length).toBeGreaterThan(0);
    await waitFor(() => expect(within(table).queryByText('Marta Nhaca')).toBeNull());
  });

  it('filtra por data e mostra o estado vazio', async () => {
    renderApp({ route: '/painel/auditoria', as: 'u_ana' });
    await screen.findByText('Stock 022');

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2099-01-01' } });

    expect(await screen.findByText('Nenhum registo corresponde aos filtros.')).toBeInTheDocument();
  });
});
