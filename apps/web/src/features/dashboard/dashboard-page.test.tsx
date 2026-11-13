import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/utils';
import { recentRange } from '@/features/analytics/queries';

describe('recentRange', () => {
  it('devolve um intervalo civil inclusivo de N dias', () => {
    expect(recentRange(30, new Date(2026, 10, 13))).toEqual({ from: '2026-10-15', to: '2026-11-13' });
    expect(recentRange(1, new Date(2026, 0, 1))).toEqual({ from: '2026-01-01', to: '2026-01-01' });
  });
});

describe('DashboardPage', () => {
  it('mostra os quatro totais e a saudação', async () => {
    renderApp({ route: '/painel', as: 'u_ana' });
    expect(await screen.findByText('Olá, Ana Macuácua.')).toBeInTheDocument();
    for (const label of ['Visitas', 'Cliques', 'Contactos guardados', 'Contactos enviados']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('mostra atalhos conforme o papel: o dono vê «Enviar contacto»', async () => {
    renderApp({ route: '/painel', as: 'u_paula' });
    const shortcuts = await screen.findByRole('list', { name: 'Ações rápidas' });
    expect(within(shortcuts).getByRole('link', { name: 'Enviar contacto' })).toBeInTheDocument();
    // O dono de perfil não gere empresas nem membros.
    expect(within(shortcuts).queryByRole('link', { name: 'Empresas' })).toBeNull();
    expect(within(shortcuts).queryByRole('link', { name: 'Membros' })).toBeNull();
  });

  it('o platform_admin vê o atalho de empresas', async () => {
    renderApp({ route: '/painel', as: 'u_marta' });
    const shortcuts = await screen.findByRole('list', { name: 'Ações rápidas' });
    expect(within(shortcuts).getByRole('link', { name: 'Empresas' })).toBeInTheDocument();
    expect(within(shortcuts).queryByRole('link', { name: 'Cartões' })).toBeNull();
  });
});
