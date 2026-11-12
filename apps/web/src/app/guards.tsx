import type { Permission } from '@nfc-business/shared/permissions';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/shared/components/ui/spinner';
import { commonTexts } from '@/shared/i18n/panel/common';
import { ForbiddenPage } from './error-pages';
import { useSession, usePermission } from './session';
import { isSessionExpired } from './session-events';

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-8" label={commonTexts.states.loading} />
    </div>
  );
}

interface RequireAuthProps {
  /** Na configuração do MFA não se reencaminha de volta para a própria configuração. */
  allowMfaSetup?: boolean;
}

/** Exige sessão iniciada. Sem sessão, vai para o login (ou para a página de sessão expirada). */
export function RequireAuth({ allowMfaSetup = false }: RequireAuthProps) {
  const { data: user, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to={isSessionExpired() ? '/sessao-expirada' : '/entrar'} state={{ from: location }} replace />;
  }
  // Administradores sem MFA configurado não entram no painel (RF-FE-04).
  if (!allowMfaSetup && user.mfaRequired && !user.mfaEnabled) {
    return <Navigate to="/configurar-mfa" replace />;
  }
  return <Outlet />;
}

/** Só para quem não tem sessão (login, recuperação). Com sessão, vai para o painel. */
export function RequireGuest() {
  const { data: user, isPending } = useSession();
  if (isPending) return <FullScreenLoader />;
  if (user) return <Navigate to="/painel" replace />;
  return <Outlet />;
}

/** Protege rotas por permissão. Sem permissão mostra a página 403 (não reencaminha). */
export function RequirePermission({ permission }: { permission: Permission }) {
  return usePermission(permission) ? <Outlet /> : <ForbiddenPage />;
}
