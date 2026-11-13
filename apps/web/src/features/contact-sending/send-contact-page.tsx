import { Send } from 'lucide-react';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Spinner } from '@/shared/components/ui/spinner';
import { contactTexts } from '@/shared/i18n/panel/contact';
import { commonTexts } from '@/shared/i18n/panel/common';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { ContactHistory } from './contact-history';
import { SendContactForm } from './send-contact-form';
import { useSendableProfilesQuery } from './queries';

export function SendContactPage() {
  useDocumentTitle(contactTexts.title);
  const profiles = useSendableProfilesQuery();

  return (
    <section>
      <PageHeader title={contactTexts.title} description={contactTexts.description} />

      {profiles.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={commonTexts.states.loading} />
        </div>
      ) : profiles.isError ? (
        <ErrorState error={profiles.error} onRetry={() => void profiles.refetch()} />
      ) : profiles.data.length === 0 ? (
        <EmptyState icon={Send} title={contactTexts.empty.title} description={contactTexts.empty.description} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{contactTexts.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <SendContactForm profiles={profiles.data} />
            </CardContent>
          </Card>
          <ContactHistory profiles={profiles.data} />
        </div>
      )}
    </section>
  );
}
