import { ChevronDown } from 'lucide-react';
import { useId, type Ref, type SelectHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import { commonTexts } from '@/shared/i18n/panel/common';
import { Label } from './label';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
}

/** `<select>` nativo estilado (ADR-0006: sem menus de JavaScript que injetem estilos). */
export function Select({ className, ref, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-md border border-input bg-card px-3 pr-9 text-sm text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive',
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export interface SelectFieldProps extends SelectProps {
  label: string;
  error?: string;
  description?: string;
  /** Não mostrar a marca «Opcional» (por exemplo, em filtros). */
  hideOptional?: boolean;
}

export function SelectField({ label, error, description, required, hideOptional, id, ref, children, ...props }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descriptionId = description ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>
        {label}
        {required || hideOptional ? null : (
          <span className="ml-2 text-xs font-normal text-muted-foreground">{commonTexts.states.optional}</span>
        )}
      </Label>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <Select id={fieldId} ref={ref} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props}>
        {children}
      </Select>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
