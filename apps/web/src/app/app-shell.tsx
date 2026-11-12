import { can } from '@nfc-business/shared/permissions';
import type { SessionUser } from '@nfc-business/shared/schemas';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';
import { commonTexts } from '@/shared/i18n/panel/common';
import { navTexts } from '@/shared/i18n/panel/nav';
import { cn } from '@/shared/lib/cn';
import { navItems } from './nav-items';
import { useCurrentUser } from './session';
import { ThemeToggle } from './theme-toggle';
import { useSignOut } from './use-sign-out';

const ROLE_LABELS: Record<SessionUser['role'], string> = {
  platform_admin: 'Administrador da plataforma',
  company_admin: 'Administrador da empresa',
  company_editor: 'Editor',
  profile_owner: 'Dono de perfil',
};

/** Layout do painel: barra lateral no ecrã grande, menu colapsável no telemóvel. */
export function AppShell() {
  const user = useCurrentUser();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(location.pathname);

  // Fecha o menu do telemóvel ao mudar de página (ajuste de estado durante o render, sem efeito).
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  if (!user) return null;

  const items = navItems.filter((item) => !item.permission || can(user.role, item.permission));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {navTexts.skipToContent}
      </a>

      {/* Barra lateral (ecrã grande) */}
      <aside className="hidden border-r bg-card lg:flex lg:flex-col">
        <SidebarContent items={items} user={user} />
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Cabeçalho (telemóvel) */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
          <span className="text-lg font-semibold">{commonTexts.appName}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            aria-label={menuOpen ? navTexts.closeMenu : navTexts.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </header>

        {menuOpen ? (
          <div id="menu-principal" className="border-b bg-card lg:hidden">
            <SidebarContent items={items} user={user} onNavigate={() => setMenuOpen(false)} />
          </div>
        ) : null}

        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  items: typeof navItems;
  user: SessionUser;
  onNavigate?: () => void;
}

function SidebarContent({ items, user, onNavigate }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <span className="hidden px-3 py-2 text-lg font-semibold lg:block">{commonTexts.appName}</span>

      <nav aria-label={navTexts.primary} className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t pt-3">
        <div className="px-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </div>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const signOut = useSignOut();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate()}
    >
      {signOut.isPending ? <Spinner className="size-4" /> : <LogOut aria-hidden="true" />}
      <span>{navTexts.signOut}</span>
    </Button>
  );
}
