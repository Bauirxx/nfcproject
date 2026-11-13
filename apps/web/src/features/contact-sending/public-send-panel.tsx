// Painel de envio para o dono do cartão na página pública (T-FE-11). É carregado por `import()` dinâmico,
// por isso toda a sua dependência pesada (react-query, react-hook-form, zod) fica fora do bundle público (ADR-0003).
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient } from '@/app/query-client';
import { Toaster } from '@/shared/components/ui/toaster';
import type { SendableProfile } from './queries';
import { SendContactForm } from './send-contact-form';

/** Fornece os seus próprios providers: a página pública não está dentro do cliente de dados nem do Toaster. */
export default function PublicSendPanel({ profile }: { profile: SendableProfile }) {
  const [client] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={client}>
      {/* Repõe as cores do painel para o formulário ficar legível sobre qualquer tema do perfil. */}
      <div className="w-full rounded-lg border bg-background p-4 text-left text-foreground">
        <SendContactForm profiles={[profile]} defaultProfileId={profile.id} />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
