import { useState } from 'react';
import { ErrorState } from '@/shared/components/ui/error-state';
import { Pagination } from '@/shared/components/ui/pagination';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { formatDateTime } from '@/shared/i18n/format';
import { commonTexts } from '@/shared/i18n/panel/common';
import { contactTexts, shareChannelLabels } from '@/shared/i18n/panel/contact';
import { useContactSharesQuery, type SendableProfile } from './queries';

const PAGE_SIZE = 10;

export function ContactHistory({ profiles }: { profiles: SendableProfile[] }) {
  const [page, setPage] = useState(1);
  const [profileId, setProfileId] = useState('');
  const history = useContactSharesQuery({ page, pageSize: PAGE_SIZE, profileId: profileId || undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{contactTexts.history.title}</h2>
        <p className="text-sm text-muted-foreground">{contactTexts.history.description}</p>
      </div>

      {profiles.length > 1 ? (
        <div className="max-w-xs">
          <SelectField
            label={contactTexts.history.filterLabel}
            hideOptional
            value={profileId}
            onChange={(event) => {
              setProfileId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{contactTexts.history.allProfiles}</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </SelectField>
        </div>
      ) : null}

      {history.isPending ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-6" label={commonTexts.states.loading} />
        </div>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.total === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {contactTexts.history.empty}
        </p>
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>{contactTexts.history.columns.recipient}</Th>
                <Th>{contactTexts.history.columns.channel}</Th>
                <Th>{contactTexts.history.columns.profile}</Th>
                <Th>{contactTexts.history.columns.date}</Th>
              </Tr>
            </THead>
            <TBody>
              {history.data.items.map((share) => (
                <Tr key={share.id}>
                  <Td className="font-medium tabular-nums">{share.recipientMasked}</Td>
                  <Td>{shareChannelLabels[share.channel]}</Td>
                  <Td className="text-muted-foreground">{share.profileName}</Td>
                  <Td className="text-muted-foreground">{formatDateTime(share.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={history.data.page}
            pageSize={history.data.pageSize}
            total={history.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
