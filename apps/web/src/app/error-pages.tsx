import { FileQuestion, LogOut, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { errorPageTexts } from '@/shared/i18n/panel/error-pages';
import { clearSessionExpired } from './session-events';

interface ErrorScreenProps {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  body: string;
  action: ReactNode;
}

/** Molde das páginas de erro: ícone, título, explicação e uma ação de saída (RF-FE-21). */
function ErrorScreen({ icon: Icon, title, body, action }: ErrorScreenProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <Icon aria-hidden className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{body}</p>
      <div className="pt-2">{action}</div>
    </main>
  );
}

export function ForbiddenPage() {
  const { title, body, action } = errorPageTexts.forbidden;
  return (
    <ErrorScreen
      icon={ShieldAlert}
      title={title}
      body={body}
      action={
        <Button asChild variant="outline">
          <Link to="/painel">{action}</Link>
        </Button>
      }
    />
  );
}

export function NotFoundPage() {
  const { title, body, action } = errorPageTexts.notFound;
  return (
    <ErrorScreen
      icon={FileQuestion}
      title={title}
      body={body}
      action={
        <Button asChild variant="outline">
          <Link to="/painel">{action}</Link>
        </Button>
      }
    />
  );
}

/** Usada como `errorElement` do router: qualquer erro não tratado cai aqui. */
export function ServerErrorPage() {
  const { title, body, action } = errorPageTexts.serverError;
  return (
    <ErrorScreen
      icon={TriangleAlert}
      title={title}
      body={body}
      action={
        <Button variant="outline" onClick={() => window.location.reload()}>
          {action}
        </Button>
      }
    />
  );
}

export function SessionExpiredPage() {
  const { title, body, action } = errorPageTexts.sessionExpired;
  // Ao ver esta página o aviso já cumpriu o seu papel; limpa-se para não reaparecer no próximo login.
  useEffect(() => clearSessionExpired(), []);
  return (
    <ErrorScreen
      icon={LogOut}
      title={title}
      body={body}
      action={
        <Button asChild>
          <Link to="/entrar">{action}</Link>
        </Button>
      }
    />
  );
}
