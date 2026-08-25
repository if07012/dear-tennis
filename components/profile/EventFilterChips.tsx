'use client';

import { useMemo, useState } from 'react';
import {
  chipOrder,
  chipPalette,
  chipEmojis,
  chipLabels,
} from '@/data/profile';
import { FilterIcon, SearchIcon, XIcon } from '@/components/ui/Icons';

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** How many chips are visible before "Show more" appears. Default 8. */
  collapsedLimit?: number;
};

export function EventFilterChips({
  selectedIds,
  onChange,
  collapsedLimit = 8,
}: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visibleChips = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = chipOrder.filter((id) => {
      if (!q) return true;
      return chipLabels[id].toLowerCase().includes(q);
    });
    if (expanded || query.trim().length > 0) return matches;
    return matches.slice(0, collapsedLimit);
  }, [query, expanded, collapsedLimit]);

  const hiddenCount = chipOrder.length - collapsedLimit;

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(chipOrder.filter((cid) => next.has(cid)));
  };

  const selectAll = () => onChange([...chipOrder]);
  const clearAll = () => onChange([]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-hunter-green">
          <FilterIcon size={14} />
          Filter event
        </span>

        <label className="ml-auto flex flex-1 min-w-[180px] items-center gap-2 rounded-full border border-light-gray bg-white px-3 py-1.5 text-sm focus-within:border-hunter-green">
          <SearchIcon size={16} className="text-dark-gray" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari event..."
            className="w-full border-0 bg-transparent text-sm text-graphite placeholder:text-dark-gray focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-dark-gray transition-colors hover:text-paprika"
            >
              <XIcon size={14} />
            </button>
          )}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full border border-paprika px-3 py-1.5 text-xs font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white"
          >
            <XIcon size={12} />
            Clear ({selectedIds.length})
          </button>
        ) : (
          <button
            type="button"
            onClick={selectAll}
            className="inline-flex items-center gap-1 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            Select all
          </button>
        )}

        {selectedIds.length > 0 && (
          <span className="text-xs text-dark-gray">
            {selectedIds.length} dipilih
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleChips.map((id) => {
          const palette = chipPalette[id];
          const emoji = chipEmojis[id];
          const isSelected = selectedSet.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? `inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${palette?.border ?? 'border-hunter-green'} ${palette?.bg ?? 'bg-hunter-green/10'} ${palette?.text ?? 'text-hunter-green'} shadow-sm`
                  : `inline-flex items-center gap-1.5 rounded-full border ${palette?.border ?? 'border-light-gray'} bg-white px-3 py-1.5 text-xs font-semibold text-graphite transition-all hover:border-hunter-green hover:bg-hunter-green/5`
  }
            >
              <span aria-hidden="true">{emoji}</span>
              {chipLabels[id]}
              {isSelected && (
                <span className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-current/10 text-[0.55rem]">
                  ✓
                </span>
              )}
            </button>
          );
        })}

        {visibleChips.length === 0 && (
          <span className="text-xs text-dark-gray">
            Tidak ada event yang cocok dengan "{query}"
          </span>
        )}
      </div>

      {!expanded && hiddenCount > 0 && query.trim().length === 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-xs font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:text-paprika"
        >
          Show {hiddenCount} more
        </button>
      )}

      {expanded && query.trim().length === 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="self-start text-xs font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:text-paprika"
        >
          Show less
        </button>
      )}
    </div>
  );
}