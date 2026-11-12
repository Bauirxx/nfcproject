import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/shared/components/ui/card';
import { commonTexts } from '@/shared/i18n/panel/common';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Moldura centrada dos ecrãs de autenticação. O título é o `h1` da página. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <p className="text-center text-sm font-semibold text-muted-foreground">{commonTexts.appName}</p>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
