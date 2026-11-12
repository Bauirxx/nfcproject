import type { Permission } from '@nfc-business/shared/permissions';
import {
  Building2,
  ChartColumn,
  Contact,
  IdCard,
  LayoutDashboard,
  Palette,
  ScrollText,
  Send,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { navTexts } from '@/shared/i18n/panel/nav';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Sem permissão, o item aparece a todos. O esconder serve só a usabilidade; o acesso é do backend. */
  permission?: Permission;
  /** Correspondência exata do caminho (só o painel inicial). */
  end?: boolean;
}

export const navItems: readonly NavItem[] = [
  { to: '/painel', label: navTexts.items.dashboard, icon: LayoutDashboard, end: true },
  { to: '/painel/empresas', label: navTexts.items.companies, icon: Building2, permission: 'companies.manage' },
  { to: '/painel/membros', label: navTexts.items.members, icon: Users, permission: 'members.manage' },
  { to: '/painel/cartoes', label: navTexts.items.cards, icon: IdCard, permission: 'cards.view' },
  { to: '/painel/perfis', label: navTexts.items.profiles, icon: Contact, permission: 'profiles.view' },
  { to: '/painel/enviar-contacto', label: navTexts.items.contact, icon: Send, permission: 'contact.send' },
  { to: '/painel/temas', label: navTexts.items.themes, icon: Palette, permission: 'themes.manage' },
  { to: '/painel/estatisticas', label: navTexts.items.analytics, icon: ChartColumn, permission: 'analytics.view' },
  { to: '/painel/auditoria', label: navTexts.items.audit, icon: ScrollText, permission: 'audit.view' },
  { to: '/painel/conta', label: navTexts.items.account, icon: Settings, permission: 'account.manage' },
];
