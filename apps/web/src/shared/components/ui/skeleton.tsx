import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

/** Marcador de conteúdo a carregar. Decorativo: fica escondido dos leitores de ecrã. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
