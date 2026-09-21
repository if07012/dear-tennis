'use client';

import { useState } from 'react';
import { ChevronDown } from '@/components/ui/Icons';
import { MobileActionMenu } from './MobileActionMenu';

type ColumnPriority = 1 | 2 | 3;

type Column<T> = {
  key: string;
  header: string;
  priority: ColumnPriority;
  render: (item: T) => React.ReactNode;
  className?: string;
};

type Action<T> = {
  label: string;
  onClick: (item: T) => void;
  primary?: boolean;
  destructive?: boolean;
  disabled?: (item: T) => boolean;
};

type Props<T> = {
  items: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  rowKey: (item: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  mobileCardRender?: (item: T) => React.ReactNode;
  showMobileCardsAt?: number; // breakpoint in px, default 768
};

export function ResponsiveTable<T>({
  items,
  columns,
  actions = [],
  rowKey,
  emptyMessage = 'Tidak ada data.',
  loading = false,
  mobileCardRender,
  showMobileCardsAt = 768,
}: Props<T>) {
  const primaryActions = actions.filter((a) => a.primary);
  const secondaryActions = actions.filter((a) => !a.primary);

  // Default card renderer if not provided
  const defaultCardRender = (item: T) => {
    const p1Columns = columns.filter((c) => c.priority === 1);
    const p2Columns = columns.filter((c) => c.priority === 2);
    const p3Columns = columns.filter((c) => c.priority === 3);

    return (
      <>
        <div className="admin-card-header">
          <div className="flex-1 min-w-0">
            {p1Columns.map((col) => (
              <div key={col.key} className="truncate whitespace-pre-wrap">
                {col.render(item)}
              </div>
            ))}
          </div>
        </div>
        <div className="admin-card-body">
          {p2Columns.map((col) => (
            <div key={col.key} className="admin-card-row">
              <span className="admin-card-label">{col.header}:</span>
              <span className="admin-card-value flex-1 truncate whitespace-pre-wrap">{col.render(item)}</span>
            </div>
          ))}
          {p3Columns.map((col) => (
            <div key={col.key} className="admin-card-row text-[0.7rem] text-dark-gray">
              <span className="admin-card-label">{col.header}:</span>
              <span className="admin-card-value flex-1 truncate whitespace-pre-wrap">{col.render(item)}</span>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="admin-card-actions">
            {primaryActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => action.onClick(item)}
                disabled={action.disabled?.(item)}
                className={[
                  'admin-card-action-primary admin-touch-target',
                  action.destructive && 'admin-card-action-destructive',
                  action.disabled?.(item) && 'opacity-50 pointer-events-none',
                ].join(' ')}
              >
                {action.label}
              </button>
            ))}
            {secondaryActions.length > 0 && (
              <MobileActionMenu
                trigger={<span className="admin-action-menu-button admin-touch-target"><ChevronDown size={16} /></span>}
                actions={secondaryActions.map((action) => ({
                  label: action.label,
                  onClick: () => action.onClick(item),
                  destructive: action.destructive,
                  disabled: action.disabled?.(item),
                }))}
              />
            )}
          </div>
        )}
      </>
    );
  };

  if (loading && items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
        Memuat...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="admin-table-responsive">
          <thead>
            <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
              {columns.map((col) => (
                <th key={col.key} className="py-3 pr-4">
                  {col.header}
                </th>
              ))}
              {actions.length > 0 && (
                <th className="py-3 pr-4 text-right">Aksi</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={rowKey(item)} className="border-b border-light-gray/60 last:border-b-0 align-top">
                {columns.map((col) => (
                  <td key={col.key} className={['py-3 pr-4', col.className].join(' ')}>
                    {col.render(item)}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td className="py-3 pr-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {primaryActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => action.onClick(item)}
                          disabled={action.disabled?.(item)}
                          className={[
                            'rounded-full px-3 py-1 text-xs font-semibold transition-colors admin-touch-target',
                            action.primary
                              ? 'bg-paprika text-white hover:bg-paprika-hover'
                              : 'border border-light-gray text-dark-gray hover:border-hunter-green hover:text-hunter-green',
                            action.destructive
                              ? 'border-paprika text-paprika hover:bg-paprika hover:text-white'
                              : '',
                            action.disabled?.(item) && 'opacity-50 pointer-events-none',
                          ].join(' ')}
                        >
                          {action.label}
                        </button>
                      ))}
                      {secondaryActions.length > 0 && (
                        <MobileActionMenu
                          trigger={<span className="admin-action-menu-button admin-touch-target"><ChevronDown size={16} /></span>}
                          actions={secondaryActions.map((action) => ({
                            label: action.label,
                            onClick: () => action.onClick(item),
                            destructive: action.destructive,
                            disabled: action.disabled?.(item),
                          }))}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="admin-card-list">
        {items.map((item) => (
          <div key={rowKey(item)} className="admin-card">
            {mobileCardRender ? mobileCardRender(item) : defaultCardRender(item)}
          </div>
        ))}
      </div>
    </div>
  );
}