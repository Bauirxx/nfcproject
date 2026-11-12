// Store de avisos (toasts) ao nível do módulo: o cliente do TanStack Query e os ecrãs chamam `toast.*`
// sem precisar de contexto. Os textos vêm sempre de quem chama (traduzidos em shared/i18n).
export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const AUTO_DISMISS_MS = 6000;

let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function add(kind: ToastKind, message: string): void {
  const id = nextId;
  nextId += 1;
  toasts = [...toasts, { id, kind, message }];
  emit();
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
}

export function dismissToast(id: number): void {
  const next = toasts.filter((toastItem) => toastItem.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export const toast = {
  success: (message: string) => add('success', message),
  error: (message: string) => add('error', message),
};

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): readonly Toast[] {
  return toasts;
}
