import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { commonTexts } from '@/shared/i18n/panel/common';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      {Icon ? <Icon aria-hidden="true" className="size-10 text-muted-foreground" /> : null}
      <p className="font-medium">{title ?? commonTexts.states.empty}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
