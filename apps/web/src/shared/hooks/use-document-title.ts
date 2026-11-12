import { useEffect } from 'react';
import { commonTexts } from '@/shared/i18n/panel/common';

/** Define o título do separador do browser para o ecrã atual. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${commonTexts.appName}`;
  }, [title]);
}
