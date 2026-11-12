import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // Componente reutilizável: quem o usa associa o controlo com `htmlFor`.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}
