import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const isNavigable = pageCount > 1;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-subtle px-4 py-3 text-sm text-body">
      <span>Page {page} sur {Math.max(pageCount, 1)}</span>
      <div className="flex items-center gap-2">
        <button
          title="Page précédente"
          aria-label="Page précédente"
          className="inline-flex items-center justify-center rounded-full bg-surface-muted p-2 text-body hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
          type="button"
          disabled={!isNavigable || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          title="Page suivante"
          aria-label="Page suivante"
          className="inline-flex items-center justify-center rounded-full bg-surface-muted p-2 text-body hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
          type="button"
          disabled={!isNavigable || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
