import { Navigate, type RouteObject } from 'react-router';
import { AcceptInvitePage } from '@/features/auth/accept-invite-page';
import { LoginPage } from '@/features/auth/login-page';
import { MfaSetupPage } from '@/features/auth/mfa-setup-page';
import { MfaVerifyPage } from '@/features/auth/mfa-verify-page';
import { RecoverPasswordPage } from '@/features/auth/recover-password-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { CardDetailPage } from '@/features/cards/card-detail-page';
import { CardsPage } from '@/features/cards/cards-page';
import { CompaniesPage } from '@/features/companies/companies-page';
import { CompanyFormPage } from '@/features/companies/company-form-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { StatsPage } from '@/features/analytics/stats-page';
import { MembersPage } from '@/features/members/members-page';
import { SendContactPage } from '@/features/contact-sending/send-contact-page';
import { ProfileEditorPage } from '@/features/profiles/profile-editor-page';
import { ProfilesPage } from '@/features/profiles/profiles-page';
import { navTexts } from '@/shared/i18n/panel/nav';
import { AppShell } from './app-shell';
import { ForbiddenPage, NotFoundPage, ServerErrorPage, SessionExpiredPage } from './error-pages';
import { RequireAuth, RequireGuest, RequirePermission } from './guards';
import { PlaceholderPage } from './placeholder-page';

// Rotas como objetos para que os testes possam usar `createMemoryRouter(routes)`.
// Os elementos das áreas internas são provisórios (PlaceholderPage) até às tarefas T-FE-06 em diante.
export const routes: RouteObject[] = [
  {
    path: '/',
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <Navigate to="/painel" replace /> },

      // Autenticação (só sem sessão)
      {
        element: <RequireGuest />,
        children: [
          { path: 'entrar', element: <LoginPage /> },
          { path: 'entrar/mfa', element: <MfaVerifyPage /> },
          { path: 'recuperar-password', element: <RecoverPasswordPage /> },
        ],
      },
      // Links de uso único: acessíveis com ou sem sessão
      { path: 'definir-password', element: <ResetPasswordPage /> },
      { path: 'convite', element: <AcceptInvitePage /> },
      { path: 'sessao-expirada', element: <SessionExpiredPage /> },

      // Configuração de MFA: exige sessão, mas não a verificação de MFA já feita
      {
        element: <RequireAuth allowMfaSetup />,
        children: [{ path: 'configurar-mfa', element: <MfaSetupPage /> }],
      },

      // Painel
      {
        path: 'painel',
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              {
                element: <RequirePermission permission="companies.manage" />,
                children: [
                  { path: 'empresas', element: <CompaniesPage /> },
                  { path: 'empresas/nova', element: <CompanyFormPage /> },
                  { path: 'empresas/:id', element: <CompanyFormPage /> },
                ],
              },
              {
                element: <RequirePermission permission="members.manage" />,
                children: [{ path: 'membros', element: <MembersPage /> }],
              },
              {
                element: <RequirePermission permission="cards.view" />,
                children: [
                  { path: 'cartoes', element: <CardsPage /> },
                  { path: 'cartoes/:id', element: <CardDetailPage /> },
                ],
              },
              {
                element: <RequirePermission permission="profiles.view" />,
                children: [
                  { path: 'perfis', element: <ProfilesPage /> },
                  { path: 'perfis/:id', element: <ProfileEditorPage /> },
                ],
              },
              {
                element: <RequirePermission permission="contact.send" />,
                children: [{ path: 'enviar-contacto', element: <SendContactPage /> }],
              },
              {
                element: <RequirePermission permission="themes.manage" />,
                children: [{ path: 'temas', element: <PlaceholderPage title={navTexts.items.themes} /> }],
              },
              {
                element: <RequirePermission permission="analytics.view" />,
                children: [{ path: 'estatisticas', element: <StatsPage /> }],
              },
              {
                element: <RequirePermission permission="audit.view" />,
                children: [{ path: 'auditoria', element: <PlaceholderPage title={navTexts.items.audit} /> }],
              },
              { path: 'conta', element: <PlaceholderPage title={navTexts.items.account} /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },

      // Fora do painel
      { path: 'sem-permissao', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
