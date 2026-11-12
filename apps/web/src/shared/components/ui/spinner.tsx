import { LoaderCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface SpinnerProps {
  className?: string;
  /** Texto para leitores de ecrã; some visualmente. Vazio num botão que já tem rótulo. */
  label?: string;
}

/** Indicador de carregamento. O ícone roda com a animação do Tailwind (sem CSS em tempo de execução). */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle aria-hidden="true" className={cn('size-5 animate-spin text-muted-foreground', className)} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
