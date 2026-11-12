import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type AlertVariant = 'info' | 'error' | 'success' | 'warning';

const STYLES: Record<AlertVariant, { box: string; icon: typeof Info; iconClass: string }> = {
  info: { box: 'border-border bg-muted text-foreground', icon: Info, iconClass: 'text-muted-foreground' },
  error: { box: 'border-destructive/40 bg-destructive/10 text-foreground', icon: CircleAlert, iconClass: 'text-destructive' },
  success: { box: 'border-success/40 bg-success/10 text-foreground', icon: CircleCheck, iconClass: 'text-success' },
  warning: { box: 'border-warning/40 bg-warning/10 text-foreground', icon: TriangleAlert, iconClass: 'text-warning' },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/** Mensagem destacada. Os erros são anunciados (`role="alert"`); o resto é informação (`role="status"`). */
export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const { box, icon: Icon, iconClass } = STYLES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md border p-3 text-sm', box, className)}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', iconClass)} />
      <div className="flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5 text-muted-foreground')}>{children}</div> : null}
      </div>
    </div>
  );
}
