import { useId, type InputHTMLAttributes, type Ref } from 'react';
import { commonTexts } from '@/shared/i18n/panel/common';
import { Input } from './input';
import { Label } from './label';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Código de validação já traduzido; marca o campo como inválido e liga o `aria-describedby`. */
  error?: string;
  description?: string;
  /** Não mostrar a marca «Opcional» (por exemplo, em filtros). */
  hideOptional?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Campo de texto com rótulo, descrição e erro ligados por `aria-describedby`/`aria-invalid`.
 * Pensado para o React Hook Form: `<TextField label="Email" {...register('email')} error={...} />`.
 */
export function TextField({ label, error, description, required, hideOptional, id, ref, ...props }: TextFieldProps) {
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
      <Input
        id={fieldId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
