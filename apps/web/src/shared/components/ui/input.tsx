import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/shared/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, type = 'text', ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground',
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
