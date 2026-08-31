'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarIcon, XIcon } from '@/components/ui/Icons';

export type DateRange = { start: string; end: string } | null;

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Used by the "This Year" preset. */
  today?: Date;
};

type Preset = 'all' | '30' | '90' | 'year';

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'all', label: 'All' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: 'year', label: 'This Year' },
];

function toInputDate(d: Date): string {
  // YYYY-MM-DD in local time, suitable for <input type="date">.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function applyPreset(preset: Preset, today: Date): DateRange {
  if (preset === 'all') return null;
  const end = new Date(today);
  const start = new Date(today);
  if (preset === '30') start.setDate(start.getDate() - 30);
  if (preset === '90') start.setDate(start.getDate() - 90);
  if (preset === 'year') start.setMonth(0, 1);
  return { start: toInputDate(start), end: toInputDate(end) };
}

function detectPreset(range: DateRange, today: Date): Preset | null {
  if (!range) return 'all';
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(end, today)) {
    const diff = Math.round(
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff === 30) return '30';
    if (diff === 90) return '90';
    if (
      start.getMonth() === 0 &&
      start.getDate() === 1 &&
      start.getFullYear() === today.getFullYear()
    ) {
      return 'year';
    }
  }
  return null;
}

/**
 * Two date inputs plus quick presets (All / 30 / 90 / This Year) plus a Clear.
 * Emits `null` for "All" or whenever both fields are empty.
 */
export function DateRangeFilter({ value, onChange, today }: Props) {
  const fallbackToday = useMemo(() => new Date(), []);
  const refToday = today ?? fallbackToday;

  const [start, setStart] = useState<string>(value?.start ?? '');
  const [end, setEnd] = useState<string>(value?.end ?? '');

  // Keep internal state in sync when the parent resets the value externally.
  useEffect(() => {
    setStart(value?.start ?? '');
    setEnd(value?.end ?? '');
  }, [value]);

  const emit = useCallback(
    (nextStart: string, nextEnd: string) => {
      if (!nextStart && !nextEnd) {
        onChange(null);
        return;
      }
      onChange({ start: nextStart, end: nextEnd });
    },
    [onChange],
  );

  const handlePreset = (preset: Preset) => {
    const range = applyPreset(preset, refToday);
    if (range) {
      setStart(range.start);
      setEnd(range.end);
      onChange(range);
    } else {
      setStart('');
      setEnd('');
      onChange(null);
    }
  };

  const handleStart = (next: string) => {
    setStart(next);
    emit(next, end);
  };

  const handleEnd = (next: string) => {
    setEnd(next);
    emit(start, next);
  };

  const handleClear = () => {
    setStart('');
    setEnd('');
    onChange(null);
  };

  const activePreset = detectPreset(value, refToday);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CalendarIcon size={18} className="text-dark-gray" />
        <span className="text-sm font-semibold text-graphite">Date range</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePreset(preset.key)}
              aria-pressed={isActive}
              className={
                isActive
                  ? 'rounded-full bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors'
                  : 'rounded-full border border-light-gray bg-white px-3 py-1.5 text-xs font-semibold text-graphite transition-colors hover:border-hunter-green hover:text-hunter-green'
              }
            >
              {preset.label}
            </button>
          );
        })}

        {(start || end) && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-paprika transition-colors hover:bg-paprika/10"
          >
            <XIcon size={14} />
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
        <label className="flex w-full sm:w-auto items-center gap-2 rounded-lg border border-light-gray bg-white px-3 py-2 text-sm text-graphite focus-within:border-hunter-green">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
            From
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => handleStart(e.target.value)}
            max={end || undefined}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm focus:outline-none"
          />
        </label>
        <label className="flex w-full sm:w-auto items-center gap-2 rounded-lg border border-light-gray bg-white px-3 py-2 text-sm text-graphite focus-within:border-hunter-green">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
            To
          </span>
          <input
            type="date"
            value={end}
            onChange={(e) => handleEnd(e.target.value)}
            min={start || undefined}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}