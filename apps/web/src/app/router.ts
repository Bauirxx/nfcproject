import { createBrowserRouter } from 'react-router';
import { routes } from './routes';

export function createRouter() {
  return createBrowserRouter(routes);
}
