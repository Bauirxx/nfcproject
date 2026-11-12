import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetDb } from '@/mocks/db';
import { server } from '@/mocks/server';

// A API simulada responde a todos os pedidos /api/* durante os testes; qualquer outro pedido é um erro.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  // Rotas acrescentadas por um teste (`server.use`) e dados de demonstração voltam ao estado inicial.
  server.resetHandlers();
  resetDb();
});

afterAll(() => server.close());
