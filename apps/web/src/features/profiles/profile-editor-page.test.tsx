import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';

// O campo do cargo é o único textbox cujo nome começa por «Cargo» (o interruptor «Mostrar o cargo» é um switch).
const titleField = () => screen.getByRole('textbox', { name: /^Cargo/ });

describe('ProfileEditorPage', () => {
  it('carrega o perfil com os campos e os contactos preenchidos', async () => {
    renderApp({ route: '/painel/perfis/p_paula', as: 'u_ana' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Paula Machava' })).toBeInTheDocument();
    expect(titleField()).toHaveValue('Gestora Comercial');
    // O número surge no telefone e no WhatsApp da Paula.
    expect(screen.getAllByDisplayValue('+258841234567').length).toBeGreaterThan(0);
  });

  it('adiciona uma linha de contacto', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/perfis/p_paula', as: 'u_ana' });
    await screen.findByRole('heading', { level: 1, name: 'Paula Machava' });

    const before = screen.getAllByRole('button', { name: 'Remover contacto' }).length;
    await user.click(screen.getByRole('button', { name: 'Adicionar contacto' }));

    expect(screen.getAllByRole('button', { name: 'Remover contacto' })).toHaveLength(before + 1);
  });

  it('edita um campo e guarda', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/painel/perfis/p_paula', as: 'u_ana' });
    await screen.findByRole('heading', { level: 1, name: 'Paula Machava' });

    await user.clear(titleField());
    await user.type(titleField(), 'Diretora Comercial');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    expect(await screen.findByText('Perfil guardado.')).toBeInTheDocument();
  });

  it('o dono de perfil não vê o seletor de dono', async () => {
    renderApp({ route: '/painel/perfis/p_paula', as: 'u_paula' });
    await screen.findByRole('heading', { level: 1, name: 'Paula Machava' });
    expect(screen.queryByLabelText(/Membro dono/)).toBeNull();
  });
});
