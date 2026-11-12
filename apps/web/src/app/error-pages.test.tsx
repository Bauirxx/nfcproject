import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { errorPageTexts } from '@/shared/i18n/panel/error-pages';
import { ForbiddenPage, NotFoundPage, ServerErrorPage, SessionExpiredPage } from './error-pages';
import { isSessionExpired } from './session-events';

function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('páginas de erro', () => {
  it('403 tem título, explicação e ligação de saída', () => {
    renderInRouter(<ForbiddenPage />);
    expect(screen.getByRole('heading', { level: 1, name: errorPageTexts.forbidden.title })).toBeInTheDocument();
    expect(screen.getByText(errorPageTexts.forbidden.body)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: errorPageTexts.forbidden.action })).toHaveAttribute('href', '/painel');
  });

  it('404 encaminha de volta para o painel', () => {
    renderInRouter(<NotFoundPage />);
    expect(screen.getByRole('heading', { level: 1, name: errorPageTexts.notFound.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: errorPageTexts.notFound.action })).toHaveAttribute('href', '/painel');
  });

  it('500 oferece recarregar', () => {
    renderInRouter(<ServerErrorPage />);
    expect(screen.getByRole('heading', { level: 1, name: errorPageTexts.serverError.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: errorPageTexts.serverError.action })).toBeInTheDocument();
  });

  it('sessão expirada leva ao login e limpa o aviso', () => {
    renderInRouter(<SessionExpiredPage />);
    expect(screen.getByRole('heading', { level: 1, name: errorPageTexts.sessionExpired.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: errorPageTexts.sessionExpired.action })).toHaveAttribute('href', '/entrar');
    expect(isSessionExpired()).toBe(false);
  });
});
