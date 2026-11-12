import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorPageTexts } from '@/shared/i18n/panel/error-pages';
import { navTexts } from '@/shared/i18n/panel/nav';
import { renderApp } from '@/test/utils';

async function findNav() {
  return screen.findByRole('navigation', { name: navTexts.primary });
}

describe('AppShell e navegação por papel', () => {
  it('o company_admin vê a gestão da empresa, mas não as empresas da plataforma', async () => {
    renderApp({ route: '/painel', as: 'u_ana' });
    const nav = await findNav();

    expect(within(nav).getByRole('link', { name: navTexts.items.members })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: navTexts.items.cards })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: navTexts.items.companies })).toBeNull();
  });

  it('o platform_admin vê empresas e auditoria, mas não cartões', async () => {
    renderApp({ route: '/painel', as: 'u_marta' });
    const nav = await findNav();

    expect(within(nav).getByRole('link', { name: navTexts.items.companies })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: navTexts.items.audit })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: navTexts.items.cards })).toBeNull();
  });

  it('o dono de perfil só vê o essencial', async () => {
    renderApp({ route: '/painel', as: 'u_paula' });
    const nav = await findNav();

    expect(within(nav).getByRole('link', { name: navTexts.items.profiles })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: navTexts.items.contact })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: navTexts.items.members })).toBeNull();
    expect(within(nav).queryByRole('link', { name: navTexts.items.cards })).toBeNull();
  });

  it('mostra a 403 numa rota sem permissão, dentro do painel', async () => {
    renderApp({ route: '/painel/membros', as: 'u_paula' });
    expect(
      await screen.findByRole('heading', { level: 1, name: errorPageTexts.forbidden.title }),
    ).toBeInTheDocument();
  });

  it('sem sessão, o painel encaminha para o login', async () => {
    renderApp({ route: '/painel' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  });
});
