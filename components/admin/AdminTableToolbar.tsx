'use client';

import { useState } from 'react';
import { SearchIcon, FilterIcon, ChevronDown } from '@/components/ui/Icons';

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
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <div className="admin-toolbar">
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
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
            aria-haspopup="listbox"
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors admin-touch-target',
              activeFilter
                ? 'bg-hunter-green text-white border-hunter-green'
                : 'bg-white text-dark-gray border-light-gray hover:border-hunter-green hover:text-hunter-green',
            ].join(' ')}
          >
            <FilterIcon size={14} />
            Filter
            {activeFilter && (
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 text-[0.65rem]">
                {filters.find((f) => f.id === activeFilter)?.count ?? ''}
              </span>
            )}
            <ChevronDown size={12} />
          </button>
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
          <button
            type="button"
            onClick={() => setSortOpen(!sortOpen)}
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors admin-touch-target',
              activeSort
                ? 'bg-hunter-green text-white border-hunter-green'
                : 'bg-white text-dark-gray border-light-gray hover:border-hunter-green hover:text-hunter-green',
            ].join(' ')}
          >
            <ChevronDown size={14} className="rotate-90" />
            Urutkan
            <ChevronDown size={12} />
          </button>
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
      </div>

      <div className="admin-toolbar-actions">
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-paprika-hover hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 admin-touch-target"
          >
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}