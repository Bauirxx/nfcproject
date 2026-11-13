import { Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePermission } from '@/app/session';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Pagination } from '@/shared/components/ui/pagination';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { TextField } from '@/shared/components/ui/text-field';
import { formatDate } from '@/shared/i18n/format';
import { profileTexts } from '@/shared/i18n/panel/profiles';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { ProfileCreateDialog } from './profile-create-dialog';
import { useProfilesQuery } from './queries';

const PAGE_SIZE = 20;

export function ProfilesPage() {
  useDocumentTitle(profileTexts.title);
  const canCreate = usePermission('profiles.create');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const filtered = debouncedSearch.trim() !== '';

  const profiles = useProfilesQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.trim() || undefined,
  });

  return (
    <section>
      <PageHeader
        title={profileTexts.title}
        description={profileTexts.description}
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              {profileTexts.create.button}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 max-w-md">
        <TextField
          label={profileTexts.searchLabel}
          hideOptional
          type="search"
          placeholder={profileTexts.searchPlaceholder}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {profiles.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={profileTexts.title} />
        </div>
      ) : profiles.isError ? (
        <ErrorState error={profiles.error} onRetry={() => void profiles.refetch()} />
      ) : profiles.data.total === 0 ? (
        <EmptyState
          icon={UserRound}
          title={filtered ? profileTexts.empty.filtered : profileTexts.empty.title}
          description={filtered ? undefined : profileTexts.empty.description}
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>{profileTexts.columns.name}</Th>
                <Th>{profileTexts.columns.title}</Th>
                <Th>{profileTexts.columns.owner}</Th>
                <Th className="text-right">{profileTexts.columns.cards}</Th>
                <Th>{profileTexts.columns.updated}</Th>
                <Th className="text-right">{profileTexts.columns.actions}</Th>
              </Tr>
            </THead>
            <TBody>
              {profiles.data.items.map((profile) => (
                <Tr key={profile.id}>
                  <Td className="font-medium">{profile.displayName}</Td>
                  <Td className="text-muted-foreground">{profile.title ?? profileTexts.noTitle}</Td>
                  <Td className="text-muted-foreground">{profile.ownerName ?? profileTexts.noOwner}</Td>
                  <Td className="text-right tabular-nums">{profile.cardsCount}</Td>
                  <Td className="text-muted-foreground">{formatDate(profile.updatedAt)}</Td>
                  <Td className="text-right">
                    <Link to={`/painel/perfis/${profile.id}`} className="text-primary underline-offset-4 hover:underline">
                      {profileTexts.open}
                    </Link>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={profiles.data.page}
            pageSize={profiles.data.pageSize}
            total={profiles.data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <ProfileCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
}
