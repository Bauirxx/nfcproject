// Utilitários dos testes de componentes e de fluxos do painel.
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '@/app/providers';
import { routes } from '@/app/routes';
import { signIn } from '@/mocks/handlers/testing';

/** Cliente de dados sem repetições nem cache entre testes. */
export function makeTestClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export interface RenderAppOptions {
  /** Caminho inicial. */
  route?: string;
  /** Inicia sessão com este utilizador dos dados de demonstração antes de montar. */
  as?: string;
}

/** Monta a aplicação completa (router real) num caminho, opcionalmente com sessão iniciada. */
export function renderApp({ route = '/', as }: RenderAppOptions = {}): RenderResult & {
  client: QueryClient;
} {
  if (as) signIn(as);
  const client = makeTestClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const result = render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return Object.assign(result, { client });
}

/** Monta um componente isolado com os providers (cliente de dados e avisos). */
export function renderWithProviders(ui: ReactElement): RenderResult & { client: QueryClient } {
  const client = makeTestClient();
  const result = render(<Providers client={client}>{ui}</Providers>);
  return Object.assign(result, { client });
}
