import { CARD_TRANSITIONS, type CardAction } from '@nfc-business/shared/constants';
import { buildCardUrl } from '@nfc-business/shared/links';
import type { Card as CardModel } from '@nfc-business/shared/schemas';
import { ArrowLeft, Copy } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePermission } from '@/app/session';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { ErrorState } from '@/shared/components/ui/error-state';
import { Input } from '@/shared/components/ui/input';
import { QrCode } from '@/shared/components/ui/qr-code';
import { Select } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { toast } from '@/shared/components/ui/toast-store';
import { formatDateTime } from '@/shared/i18n/format';
import { cardHistoryLabels, cardTexts } from '@/shared/i18n/panel/cards';
import { commonTexts } from '@/shared/i18n/panel/common';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { CardStatusBadge } from './card-status-badge';
import { downloadQrPng, downloadQrSvg } from './qr-download';
import { useCardAction, useCardHistoryQuery, useCardQuery, useProfileOptionsQuery, useUpdateCard } from './queries';

type ConfirmableAction = 'deactivate' | 'lost' | 'block';

export function CardDetailPage() {
  const { id = '' } = useParams();
  const card = useCardQuery(id);
  const history = useCardHistoryQuery(id);
  const action = useCardAction(id);
  const [pending, setPending] = useState<ConfirmableAction | null>(null);
  useDocumentTitle(card.data?.label ?? cardTexts.title);

  const backLink = (
    <Link to="/painel/cartoes" className="mb-4 inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {cardTexts.detail.back}
    </Link>
  );

  if (card.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8" label={commonTexts.states.loading} />
      </div>
    );
  }
  if (card.isError) {
    return (
      <section>
        {backLink}
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      </section>
    );
  }

  const data = card.data;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const chipUrl = buildCardUrl(origin, data.token) ?? '';
  const transitions = CARD_TRANSITIONS[data.status];

  function runAction(next: CardAction) {
    if (next === 'activate') {
      action.mutate(next);
      return;
    }
    setPending(next);
  }

  function copyChipUrl() {
    void navigator.clipboard
      .writeText(chipUrl)
      .then(() => toast.success(cardTexts.detail.copied))
      .catch(() => undefined);
  }

  return (
    <section>
      {backLink}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{data.label}</h1>
        <CardStatusBadge status={data.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{cardTexts.detail.chipUrl}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{cardTexts.detail.chipUrlHint}</p>
            <div className="flex gap-2">
              <Input readOnly value={chipUrl} aria-label={cardTexts.detail.chipUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" aria-label={cardTexts.detail.copy} onClick={copyChipUrl}>
                <Copy aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="rounded-lg bg-white p-4">
                <QrCode value={chipUrl} title={cardTexts.detail.qrAlt(data.label)} className="h-40 w-40" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadQrPng(chipUrl, `qr-${data.token}.png`)}>
                  {cardTexts.detail.downloadPng}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadQrSvg(chipUrl, `qr-${data.token}.svg`)}>
                  {cardTexts.detail.downloadSvg}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <CardProfileSection card={data} />

          <Card>
            <CardHeader>
              <CardTitle>{cardTexts.detail.statusSection}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {transitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{cardTexts.detail.historyEmpty}</p>
              ) : (
                transitions.map((next) => (
                  <Button
                    key={next}
                    variant={next === 'activate' ? 'primary' : next === 'block' ? 'destructive' : 'outline'}
                    onClick={() => runAction(next)}
                    disabled={action.isPending}
                  >
                    {cardTexts.actions[next]}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{cardTexts.detail.historyTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isPending ? (
            <Spinner className="size-5" label={commonTexts.states.loading} />
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{cardTexts.detail.historyEmpty}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.data.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-0">
                  <span className="font-medium">{cardHistoryLabels[entry.action]}</span>
                  <span className="text-sm text-muted-foreground">
                    {entry.actorName} · {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {pending ? (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          onConfirm={() => action.mutate(pending, { onSettled: () => setPending(null) })}
          title={cardTexts.confirm[pending].title}
          description={cardTexts.confirm[pending].body}
          confirmLabel={cardTexts.actions[pending]}
          destructive
          loading={action.isPending}
        />
      ) : null}
    </section>
  );
}

function CardProfileSection({ card }: { card: CardModel }) {
  const canManage = usePermission('cards.manage');
  const options = useProfileOptionsQuery();
  const update = useUpdateCard(card.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.profileId ?? '');

  function startEditing() {
    setValue(card.profileId ?? '');
    setEditing(true);
  }

  function save() {
    update.mutate(
      { profileId: value === '' ? null : value },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cardTexts.detail.profileSection}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <>
            <Select value={value} onChange={(event) => setValue(event.target.value)} aria-label={cardTexts.fields.profile}>
              <option value="">{cardTexts.fields.profileNone}</option>
              {(options.data ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={update.isPending}>
                {update.isPending ? <Spinner className="size-4" /> : null}
                {cardTexts.detail.saveProfile}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={update.isPending}>
                {commonTexts.actions.cancel}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={card.profileName ? 'font-medium' : 'text-muted-foreground'}>
              {card.profileName ?? cardTexts.noProfile}
            </p>
            {canManage ? (
              <Button variant="outline" size="sm" className="self-start" onClick={startEditing}>
                {cardTexts.detail.changeProfile}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
