import { Button } from './button';
import { Alert } from './alert';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/** Estado de erro de um ecrã com dados, com a mensagem genérica e a opção de repetir. */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert variant="error" title={commonTexts.states.errorTitle}>
        {errorMessage(error)}
      </Alert>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {commonTexts.actions.retry}
        </Button>
      ) : null}
    </div>
  );
}
