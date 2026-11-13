import { useId } from 'react';
import { cn } from '@/shared/lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Rótulo visível à esquerda do interruptor. */
  label: string;
  /** Texto auxiliar por baixo do rótulo. */
  description?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Interruptor acessível (`role="switch"`) construído sobre um `<button>`.
 * Sem Radix nem estilos injetados: só classes do Tailwind (ADR-0006, CSP estrita).
 */
export function Switch({ checked, onCheckedChange, label, description, disabled, id }: SwitchProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descriptionId = description ? `${fieldId}-desc` : undefined;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex flex-col">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        id={fieldId}
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
