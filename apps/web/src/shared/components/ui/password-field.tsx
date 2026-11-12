import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';
import { commonTexts } from '@/shared/i18n/panel/common';
import { Input } from './input';
import { Label } from './label';

export interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de palavra-passe com botão para mostrar ou esconder o valor. */
export function PasswordField({ label, error, description, required, id, ref, ...props }: PasswordFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const descriptionId = description ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>
        {label}
        {required ? null : (
          <span className="ml-2 text-xs font-normal text-muted-foreground">{commonTexts.states.optional}</span>
        )}
      </Label>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="relative">
        <Input
          id={fieldId}
          ref={ref}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? commonTexts.password.hide : commonTexts.password.show}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
