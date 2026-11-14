import { AUDIT_ACTIONS, type AuditAction } from '@nfc-business/shared/constants';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Pagination } from '@/shared/components/ui/pagination';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { TextField } from '@/shared/components/ui/text-field';
import { formatDateTime } from '@/shared/i18n/format';
import { auditActionLabels, auditTexts } from '@/shared/i18n/panel/audit';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useAuditQuery } from './queries';

const PAGE_SIZE = 20;

export function AuditPage() {
  useDocumentTitle(auditTexts.title);
  const [action, setAction] = useState<'' | AuditAction>('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedActor = useDebouncedValue(actor);

  const filtered = action !== '' || debouncedActor.trim() !== '' || from !== '' || to !== '';

  const audit = useAuditQuery({
    page,
    pageSize: PAGE_SIZE,
    action: action || undefined,
    actor: debouncedActor.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  function resetTo(first: () => void) {
    first();
    setPage(1);
  }

  return (
    <section>
      <PageHeader title={auditTexts.title} description={auditTexts.description} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label={auditTexts.filters.action}
          hideOptional
          value={action}
          onChange={(event) => resetTo(() => setAction(event.target.value as '' | AuditAction))}
        >
          <option value="">{auditTexts.filters.allActions}</option>
          {AUDIT_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {auditActionLabels[value]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={auditTexts.filters.actor}
          hideOptional
          type="search"
          placeholder={auditTexts.filters.actorPlaceholder}
          value={actor}
          onChange={(event) => resetTo(() => setActor(event.target.value))}
        />
        <TextField
          label={auditTexts.filters.from}
          hideOptional
          type="date"
          value={from}
          onChange={(event) => resetTo(() => setFrom(event.target.value))}
        />
        <TextField
          label={auditTexts.filters.to}
          hideOptional
          type="date"
          value={to}
          onChange={(event) => resetTo(() => setTo(event.target.value))}
        />
      </div>

      {audit.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={auditTexts.title} />
        </div>
      ) : audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.data.total === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? auditTexts.empty.filtered : auditTexts.empty.title}
          description={filtered ? undefined : auditTexts.empty.description}
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>{auditTexts.columns.action}</Th>
                <Th>{auditTexts.columns.actor}</Th>
                <Th>{auditTexts.columns.target}</Th>
                <Th>{auditTexts.columns.company}</Th>
                <Th>{auditTexts.columns.date}</Th>
              </Tr>
            </THead>
            <TBody>
              {audit.data.items.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="font-medium">{auditActionLabels[entry.action]}</Td>
                  <Td>
                    <div className="flex flex-col">
                      <span>{entry.actorName}</span>
                      <span className="text-sm text-muted-foreground">{entry.actorEmail}</span>
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{entry.target ?? auditTexts.noTarget}</Td>
                  <Td className="text-muted-foreground">{entry.companyName ?? auditTexts.noCompany}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination page={audit.data.page} pageSize={audit.data.pageSize} total={audit.data.total} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
