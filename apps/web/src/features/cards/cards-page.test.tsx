import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

describe('CardsPage', () => {
  it('procura cartões por nome', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/cartoes', as: 'u_ana' });
    await screen.findByText('Carlos Mondlane · feira');

    await user.type(screen.getByLabelText('Procurar cartões'), 'Paula');

    expect(await screen.findByText('Paula Machava · principal')).toBeInTheDocument();
  });

  it('filtra por estado', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/cartoes', as: 'u_ana' });
    await screen.findByText('Carlos Mondlane · feira');

    await user.selectOptions(screen.getByLabelText('Estado'), 'blocked');

    expect(await screen.findByText('Receção · antigo')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Mondlane · feira')).toBeNull();
  });

  it('cria um cartão e abre o detalhe', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/cartoes', as: 'u_ana' });

    await user.click(await screen.findByRole('button', { name: 'Criar cartão' }));
    await user.type(await screen.findByLabelText('Nome do cartão'), 'Cartão de teste');
    await user.click(screen.getByRole('button', { name: 'Criar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Cartão de teste' })).toBeInTheDocument();
  });
});
