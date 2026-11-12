import { Check, CircleAlert, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { commonTexts } from '@/shared/i18n/panel/common';
import { cn } from '@/shared/lib/cn';
import { dismissToast, getToasts, subscribeToasts, type Toast } from './toast-store';

/** Mostra os avisos da aplicação. Fica sempre montado uma vez, junto dos providers. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((toastItem) => (
        <ToastItem key={toastItem.id} toast={toastItem} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const isError = toast.kind === 'error';
  const Icon = isError ? CircleAlert : Check;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-card p-3 text-sm text-card-foreground shadow-lg',
        isError ? 'border-destructive/40' : 'border-success/40',
      )}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', isError ? 'text-destructive' : 'text-success')} />
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">{commonTexts.actions.close}</span>
      </button>
    </div>
  );
}
