import { isHexColor } from '@nfc-business/shared/validators';
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { Input } from './input';
import { Label } from './label';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  error?: string;
  id?: string;
}

/** Cor `#rrggbb` com seletor nativo e campo de texto ligados ao mesmo valor. */
export function ColorField({ label, value, onChange, error, id }: ColorFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const valid = isHexColor(value);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={valid ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
        />
        <Input
          id={fieldId}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value.trim())}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn('font-mono text-xs uppercase')}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
