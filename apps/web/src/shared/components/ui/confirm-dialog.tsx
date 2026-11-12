import { Button } from './button';
import { Dialog } from './dialog';
import { Spinner } from './spinner';
import { commonTexts } from '@/shared/i18n/panel/common';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ações irreversíveis usam o destaque destrutivo. */
  destructive?: boolean;
  loading?: boolean;
}

/** Confirmação de ações (sobretudo as irreversíveis), sobre o `Dialog` acessível. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = commonTexts.actions.confirm,
  cancelLabel = commonTexts.actions.cancel,
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner className="size-4" /> : null}
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
