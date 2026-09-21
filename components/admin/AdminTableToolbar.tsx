'use client';

import { useState } from 'react';
import { SearchIcon, FilterIcon, ChevronDown } from '@/components/ui/Icons';
import { AdminButton } from './AdminButton';

type FilterOption = {
  id: string;
  label: string;
  count?: number;
};

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  sortOptions?: { id: string; label: string }[];
  activeSort?: string;
  onSortChange?: (sortId: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  loading?: boolean;
  pageSize?: number;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
};

export function AdminTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari...',
  filters = [],
  activeFilter,
  onFilterChange,
  sortOptions,
  activeSort,
  onSortChange,
  onAdd,
  addLabel = 'Tambah',
  loading = false,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  return (
    <div className="admin-toolbar px-4 py-4 xs:py-2">
      <div className="admin-toolbar-search">
        <label htmlFor="admin-search" className="flex w-full items-center gap-2 rounded-lg border border-light-gray bg-white px-3 py-2 text-sm text-graphite focus-within:border-hunter-green">
          <SearchIcon size={18} className="text-dark-gray" />
          <input
            id="admin-search"
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            disabled={loading}
            className="w-full border-0 bg-transparent text-sm focus:outline-none disabled:opacity-50"
          />
        </label>
      </div>

      <div className="admin-toolbar-filters">
        {filters.length > 0 && onFilterChange && (
          <AdminButton
            type="button"
            variant="filter"
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
            aria-haspopup="listbox"
            isActive={!!activeFilter}
          >
            <FilterIcon size={14} />
            Filter
            {activeFilter && (
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 text-[0.65rem]">
                {filters.find((f) => f.id === activeFilter)?.count ?? ''}
              </span>
            )}
            <ChevronDown size={12} />
          </AdminButton>
        )}

        {filterOpen && filters.length > 0 && onFilterChange && (
          <div className="absolute z-50 mt-1 min-w-[180px] rounded-xl border border-light-gray bg-white py-1 shadow-xl">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  onFilterChange(filter.id);
                  setFilterOpen(false);
                }}
                className={[
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  activeFilter === filter.id
                    ? 'bg-hunter-green/5 text-hunter-green'
                    : 'text-graphite hover:bg-hunter-green/5 hover:text-hunter-green',
                ].join(' ')}
              >
                <span>{filter.label}</span>
                {filter.count !== undefined && (
                  <span className={[
                    'ml-2 inline-flex items-center justify-center rounded-full px-1.5 text-[0.65rem]',
                    activeFilter === filter.id
                      ? 'bg-hunter-green text-white'
                      : 'bg-light-gray text-dark-gray',
                  ].join(' ')}>
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {sortOptions && sortOptions.length > 0 && onSortChange && (
          <AdminButton
            type="button"
            variant="filter"
            onClick={() => setSortOpen(!sortOpen)}
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            isActive={!!activeSort}
          >
            <ChevronDown size={14} className="rotate-90" />
            Urutkan
            <ChevronDown size={12} />
          </AdminButton>
        )}

        {sortOpen && sortOptions && sortOptions.length > 0 && onSortChange && (
          <div className="absolute z-50 mt-1 min-w-[180px] rounded-xl border border-light-gray bg-white py-1 shadow-xl">
            {sortOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSortChange(opt.id);
                  setSortOpen(false);
                }}
                className={[
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  activeSort === opt.id
                    ? 'bg-hunter-green/5 text-hunter-green'
                    : 'text-graphite hover:bg-hunter-green/5 hover:text-hunter-green',
                ].join(' ')}
              >
                <span>{opt.label}</span>
                {activeSort === opt.id && (
                  <span className="text-hunter-green">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {onPageSizeChange && (
          <div className="relative">
            <AdminButton
              type="button"
              variant="filter"
              onClick={() => setPageSizeOpen(!pageSizeOpen)}
              aria-expanded={pageSizeOpen}
              aria-haspopup="listbox"
            >
              <ChevronDown size={14} className="rotate-90" />
              {pageSize ?? 10} / halaman
              <ChevronDown size={12} />
            </AdminButton>
            {pageSizeOpen && (
              <div className="absolute z-50 mt-1 min-w-[180px] rounded-xl border border-light-gray bg-white py-1 shadow-xl">
                {pageSizeOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onPageSizeChange(opt);
                      setPageSizeOpen(false);
                    }}
                    className={[
                      'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                      pageSize === opt
                        ? 'bg-hunter-green/5 text-hunter-green'
                        : 'text-graphite hover:bg-hunter-green/5 hover:text-hunter-green',
                    ].join(' ')}
                  >
                    <span>{opt} / halaman</span>
                    {pageSize === opt && <span className="text-hunter-green">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="admin-toolbar-actions">
        {onAdd && addLabel !== 'Tambah' && (
          <AdminButton
            type="button"
            variant="primary"
            size="md"
            onClick={onAdd}
            disabled={loading}
          >
            {addLabel}
          </AdminButton>
        )}
      </div>
    </div>
  );
}