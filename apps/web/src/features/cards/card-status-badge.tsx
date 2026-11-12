import type { CardStatus } from '@nfc-business/shared/constants';
import { Badge } from '@/shared/components/ui/badge';
import { cardStatusLabels } from '@/shared/i18n/panel/cards';

const STATUS_VARIANT = {
  active: 'success',
  inactive: 'neutral',
  lost: 'warning',
  blocked: 'destructive',
} as const;

export function CardStatusBadge({ status }: { status: CardStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{cardStatusLabels[status]}</Badge>;
}
