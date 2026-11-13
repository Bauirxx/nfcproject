import type { AnalyticsTotals } from '@nfc-business/shared/schemas';
import {
  Building2,
  ChartColumn,
  IdCard,
  ScrollText,
  Send,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { usePermission, useCurrentUser } from '@/app/session';
import { Card, CardContent } from '@/shared/components/ui/card';
import { ErrorState } from '@/shared/components/ui/error-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PageHeader } from '@/shared/components/ui/page-header';
import { formatNumber } from '@/shared/i18n/format';
import { dashboardTexts } from '@/shared/i18n/panel/dashboard';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { recentRange, useAnalyticsSummaryQuery } from '@/features/analytics/queries';

const METRIC_ORDER: ReadonlyArray<keyof AnalyticsTotals> = ['views', 'clicks', 'vcfDownloads', 'contactsSent'];

interface Shortcut {
  show: boolean;
  to: string;
  label: string;
  icon: LucideIcon;
  /** Em destaque para o dono de perfil (envio de contacto). */
  highlight?: boolean;
}

export function DashboardPage() {
  useDocumentTitle(dashboardTexts.title);
  const user = useCurrentUser();
  const range = useMemo(() => recentRange(30), []);
  const summary = useAnalyticsSummaryQuery(range);

  const isOwner = user?.role === 'profile_owner';
  const shortcuts: Shortcut[] = [
    { show: usePermission('contact.send'), to: '/painel/enviar-contacto', label: dashboardTexts.shortcuts.sendContact, icon: Send, highlight: isOwner },
    { show: usePermission('cards.view'), to: '/painel/cartoes', label: dashboardTexts.shortcuts.cards, icon: IdCard },
    { show: usePermission('profiles.view'), to: '/painel/perfis', label: dashboardTexts.shortcuts.profiles, icon: UserRound },
    { show: usePermission('members.manage'), to: '/painel/membros', label: dashboardTexts.shortcuts.members, icon: Users },
    { show: usePermission('companies.manage'), to: '/painel/empresas', label: dashboardTexts.shortcuts.companies, icon: Building2 },
    { show: usePermission('analytics.view'), to: '/painel/estatisticas', label: dashboardTexts.shortcuts.analytics, icon: ChartColumn },
    { show: usePermission('audit.view'), to: '/painel/auditoria', label: dashboardTexts.shortcuts.audit, icon: ScrollText },
  ];
  const allowed = shortcuts.filter((shortcut) => shortcut.show);

  return (
    <section>
      <PageHeader title={dashboardTexts.title} description={user ? dashboardTexts.welcome(user.name) : undefined} />

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{dashboardTexts.rangeLabel}</h2>
      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRIC_ORDER.map((metric) => (
            <Card key={metric}>
              <CardContent className="flex flex-col gap-1 p-5">
                <dt className="text-sm text-muted-foreground">{dashboardTexts.metrics[metric]}</dt>
                <dd className="text-3xl font-semibold tabular-nums">
                  {summary.isPending ? <Skeleton className="h-9 w-16" /> : formatNumber(summary.data.totals[metric])}
                </dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">{dashboardTexts.shortcutsTitle}</h2>
      <ul aria-label={dashboardTexts.shortcutsTitle} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {allowed.map((shortcut) => (
          <li key={shortcut.to}>
            <Link
              to={shortcut.to}
              className={`flex items-center gap-3 rounded-lg border p-4 font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                shortcut.highlight ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <shortcut.icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span>{shortcut.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
