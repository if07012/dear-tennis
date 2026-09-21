'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';
import { AdminButton } from './AdminButton';

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  showPageNumbers?: boolean;
};

function pageButtons(current: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push('…');
  out.push(totalPages);
  return out;
}

export function ResponsivePagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  showPageNumbers = true,
}: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="admin-pager border-t border-light-gray pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AdminButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || disabled}
          >
            <ChevronLeft size={14} />
            Sebelumnya
          </AdminButton>
          {showPageNumbers && (
            <div className="flex items-center gap-1">
              {pageButtons(page, totalPages).map((p, idx) =>
                p === '…' ? (
                  <span
                    key={`gap-${idx}`}
                    className="px-1 text-xs text-dark-gray"
                    aria-hidden="true"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    disabled={disabled}
                    aria-current={p === page ? 'page' : undefined}
                    className={[
                      'h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-50',
                      p === page
                        ? 'bg-hunter-green text-white'
                        : 'bg-off-white text-dark-gray hover:bg-light-gray',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          )}
          <AdminButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || disabled}
          >
            Berikutnya
            <ChevronRight size={14} />
          </AdminButton>
        </div>
      </div>
    </div>
  );
}