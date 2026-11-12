// Todos os handlers da API simulada (ADR-0004). Qualquer outro pedido a /api/* recebe um 404 no formato do
// contrato, para que nenhum pedido do frontend saia para a rede em desenvolvimento ou nos testes.
import { http, type HttpHandler } from 'msw';
import { analyticsHandlers } from './analytics';
import { auditHandlers } from './audit';
import { authHandlers } from './auth';
import { cardHandlers } from './cards';
import { companyHandlers } from './companies';
import { contactShareHandlers } from './contact-shares';
import { failure } from './http';
import { memberHandlers } from './members';
import { profileHandlers } from './profiles';
import { publicHandlers } from './public';
import { uploadHandlers } from './uploads';

export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...companyHandlers,
  ...memberHandlers,
  ...cardHandlers,
  ...profileHandlers,
  ...uploadHandlers,
  ...contactShareHandlers,
  ...analyticsHandlers,
  ...auditHandlers,
  ...publicHandlers,
  http.all('/api/*', () => failure(404, 'not_found')),
];
