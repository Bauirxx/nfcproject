import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { formatDate } from '@/shared/i18n/format';
import { companyTexts } from '@/shared/i18n/panel/companies';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useCompaniesQuery } from './queries';

export function CompaniesPage() {
  useDocumentTitle(companyTexts.title);
  const companies = useCompaniesQuery();

  return (
    <section>
      <PageHeader
        title={companyTexts.title}
        description={companyTexts.description}
        actions={
          <Button asChild>
            <Link to="/painel/empresas/nova">
              <Plus aria-hidden="true" />
              {companyTexts.create.button}
            </Link>
          </Button>
        }
      />

      {companies.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={companyTexts.title} />
        </div>
      ) : companies.isError ? (
        <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
      ) : companies.data.items.length === 0 ? (
        <EmptyState icon={Building2} title={companyTexts.empty.title} description={companyTexts.empty.description} />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>{companyTexts.columns.name}</Th>
              <Th>{companyTexts.columns.contact}</Th>
              <Th className="text-right">{companyTexts.columns.cards}</Th>
              <Th className="text-right">{companyTexts.columns.members}</Th>
              <Th>{companyTexts.columns.created}</Th>
              <Th className="text-right">{companyTexts.columns.actions}</Th>
            </Tr>
          </THead>
          <TBody>
            {companies.data.items.map((company) => (
              <Tr key={company.id}>
                <Td className="font-medium">{company.name}</Td>
                <Td className="text-muted-foreground">{company.contactEmail}</Td>
                <Td className="text-right tabular-nums">{company.cardsCount}</Td>
                <Td className="text-right tabular-nums">{company.membersCount}</Td>
                <Td className="text-muted-foreground">{formatDate(company.createdAt)}</Td>
                <Td className="text-right">
                  <Link
                    to={`/painel/empresas/${company.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {companyTexts.open}
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}
