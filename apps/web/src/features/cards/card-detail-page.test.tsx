import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_TOKENS } from '@/mocks/credentials';
import { renderApp } from '@/test/utils';

describe('CardDetailPage', () => {
  it('mostra o endereço do chip com o token do cartão', async () => {
    renderApp({ route: '/painel/cartoes/c_paula', as: 'u_ana' });
    const chip = await screen.findByLabelText<HTMLInputElement>('Endereço do chip');
    expect(chip.value).toContain(MOCK_TOKENS.activeCard);
  });

  it('desativa um cartão ativo após confirmação', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/cartoes/c_paula', as: 'u_ana' });

    await user.click(await screen.findByRole('button', { name: 'Desativar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Desativar o cartão?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(await screen.findByText('Inativo')).toBeInTheDocument();
  });

  it('mostra o histórico do cartão', async () => {
    renderApp({ route: '/painel/cartoes/c_paula', as: 'u_ana' });
    expect(await screen.findByText('Cartão criado')).toBeInTheDocument();
  });
});
