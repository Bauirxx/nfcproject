import { useId, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import { commonTexts } from '@/shared/i18n/panel/common';
import { Label } from './label';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, rows = 4, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:outline-destructive',
        className,
      )}
      {...props}
    />
  );
}

export interface TextareaFieldProps extends TextareaProps {
  label: string;
  error?: string;
  description?: string;
  hideOptional?: boolean;
}

export function TextareaField({ label, error, description, required, hideOptional, id, ref, ...props }: TextareaFieldProps) {
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
      <Textarea
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
