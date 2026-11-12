import { CARD_STATUSES, type CardStatus } from '@nfc-business/shared/constants';
import { IdCard, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePermission } from '@/app/session';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Pagination } from '@/shared/components/ui/pagination';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { TextField } from '@/shared/components/ui/text-field';
import { formatDate } from '@/shared/i18n/format';
import { cardStatusLabels, cardTexts } from '@/shared/i18n/panel/cards';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { CardCreateDialog } from './card-create-dialog';
import { CardStatusBadge } from './card-status-badge';
import { useCardsQuery } from './queries';

const PAGE_SIZE = 20;

export function CardsPage() {
  useDocumentTitle(cardTexts.title);
  const canManage = usePermission('cards.manage');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | CardStatus>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const filtered = debouncedSearch.trim() !== '' || status !== '';

  const cards = useCardsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.trim() || undefined,
    status: status || undefined,
  });

  return (
    <section>
      <PageHeader
        title={cardTexts.title}
        description={cardTexts.description}
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              {cardTexts.create.button}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label={cardTexts.searchLabel}
            hideOptional
            type="search"
            placeholder={cardTexts.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-56">
          <SelectField
            label={cardTexts.statusLabel}
            hideOptional
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | CardStatus);
              setPage(1);
            }}
          >
            <option value="">{cardTexts.statusAll}</option>
            {CARD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {cardStatusLabels[value]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {cards.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={cardTexts.title} />
        </div>
      ) : cards.isError ? (
        <ErrorState error={cards.error} onRetry={() => void cards.refetch()} />
      ) : cards.data.total === 0 ? (
        <EmptyState
          icon={IdCard}
          title={filtered ? cardTexts.empty.filtered : cardTexts.empty.title}
          description={filtered ? undefined : cardTexts.empty.description}
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>{cardTexts.columns.label}</Th>
                <Th>{cardTexts.columns.status}</Th>
                <Th>{cardTexts.columns.profile}</Th>
                <Th>{cardTexts.columns.updated}</Th>
                <Th className="text-right">{cardTexts.columns.actions}</Th>
              </Tr>
            </THead>
            <TBody>
              {cards.data.items.map((card) => (
                <Tr key={card.id}>
                  <Td className="font-medium">{card.label}</Td>
                  <Td>
                    <CardStatusBadge status={card.status} />
                  </Td>
                  <Td className="text-muted-foreground">{card.profileName ?? cardTexts.noProfile}</Td>
                  <Td className="text-muted-foreground">{formatDate(card.updatedAt)}</Td>
                  <Td className="text-right">
                    <Link
                      to={`/painel/cartoes/${card.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {cardTexts.open}
                    </Link>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination page={cards.data.page} pageSize={cards.data.pageSize} total={cards.data.total} onPageChange={setPage} />
        </>
      )}

      <CardCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
}
