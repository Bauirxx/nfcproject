import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

describe('ThemesPage', () => {
  it('mostra o editor de tema do primeiro perfil e troca de perfil', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/temas', as: 'u_ana' });

    const select = await screen.findByLabelText('Perfil');
    expect(screen.getByRole('button', { name: 'Guardar tema' })).toBeInTheDocument();

    await user.selectOptions(select, 'p_recepcao');
    expect(select).toHaveValue('p_recepcao');
    expect(screen.getByRole('button', { name: 'Guardar tema' })).toBeInTheDocument();
  });

  it('bloqueia o guardar quando o contraste é insuficiente', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/temas', as: 'u_edu' });

    const text = await screen.findByRole('textbox', { name: 'Cor do texto' });
    await user.clear(text);
    await user.type(text, '#eeeeee');

    expect(screen.getByRole('button', { name: 'Guardar tema' })).toBeDisabled();
  });

  it('nega o acesso a quem não gere temas', async () => {
    renderApp({ route: '/painel/temas', as: 'u_paula' });
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
  });
});
