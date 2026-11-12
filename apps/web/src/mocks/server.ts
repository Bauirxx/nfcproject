// Servidor MSW para os testes em Node (Vitest com jsdom): a mesma API simulada que o browser usa em desenvolvimento.
// É ligado em `src/test/setup.ts`; os testes de handlers acrescentam-lhe rotas com `useMockServer` (`handlers/testing.ts`).
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
