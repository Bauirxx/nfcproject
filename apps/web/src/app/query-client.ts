import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';

declare module '@tanstack/react-query' {
  interface Register {
    // `inlineError: true` numa mutação pede que o erro seja mostrado no próprio formulário,
    // e não como aviso global.
    mutationMeta: { inlineError?: boolean };
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
    },
    // Mutações sem tratamento próprio mostram um aviso com a mensagem genérica do erro.
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.options.meta?.inlineError) toast.error(errorMessage(error));
      },
    }),
  });
}
