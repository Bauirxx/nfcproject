import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { commonTexts } from '@/shared/i18n/panel/common';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Navegação entre páginas de uma lista. Não aparece quando só há uma página. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="mt-4 flex items-center justify-between gap-4" aria-label={commonTexts.pagination.page(page, totalPages)}>
      <p className="text-sm text-muted-foreground">{commonTexts.pagination.range(from, to, total)}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden="true" />
          {commonTexts.pagination.previous}
        </Button>
        <span className="text-sm text-muted-foreground">{commonTexts.pagination.page(page, totalPages)}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {commonTexts.pagination.next}
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
