'use client';

import { useMemo, useState } from 'react';
import { eventHistory, chipEmojis } from '@/data/profile';
import type { EventType, FilterableEvent } from '@/data/profile-types';
import { DateRangeFilter, type DateRange } from '@/components/ui/DateRangeFilter';
import { FilterIcon, CalendarIcon, MapPinIcon, UsersIcon } from '@/components/ui/Icons';
import { MatchScorecard } from './MatchScorecard';

const TYPE_OPTIONS: Array<{ key: EventType | 'all'; label: string }> = [
  { key: 'all', label: 'All Types' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'championship', label: 'Championship' },
  { key: 'funmatch', label: 'Fun Match' },
  { key: 'open', label: 'Open' },
  { key: 'training', label: 'Training' },
];

function withinRange(dateISO: string, range: DateRange): boolean {
  if (!range) return true;
  const t = new Date(dateISO).getTime();
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime() + 24 * 60 * 60 * 1000 - 1; // inclusive end-of-day
  return t >= start && t <= end;
}

const PAGE_SIZE = 4;

export function EventHistory() {
  const [type, setType] = useState<EventType | 'all'>('all');
  const [range, setRange] = useState<DateRange>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo<FilterableEvent[]>(() => {
    return eventHistory.filter((evt) => {
      if (type !== 'all' && evt.type !== type) return false;
      if (!withinRange(evt.date, range)) return false;
      return true;
    });
  }, [type, range]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="profile-section-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            Event History
          </h2>
          <p className="text-sm text-dark-gray">
            Riwayat partisipasi kamu di setiap event
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-graphite">
            <FilterIcon size={16} />
            Event type
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as EventType | 'all');
              setVisible(PAGE_SIZE);
            }}
            className="rounded-lg border border-light-gray bg-white px-3 py-2 text-sm text-graphite focus:border-hunter-green focus:outline-none"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <DateRangeFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setVisible(PAGE_SIZE);
          }}
        />
      </div>

      <p className="mt-4 text-xs text-dark-gray">
        Menampilkan <span className="font-bold text-hunter-green">{shown.length}</span>{' '}
        dari <span className="font-bold text-hunter-green">{filtered.length}</span> event
      </p>

      <div className="mt-3 grid gap-3">
        {shown.map((evt) => (
          <article
            key={evt.id}
            className={`event-history-item ${evt.type} relative rounded-xl border border-light-gray bg-off-white p-4`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pr-4">
              <div className="flex items-start gap-3">
                <span
                  className="text-2xl"
                  aria-hidden="true"
                  title={evt.title}
                >
                  {chipEmojis[evt.id] ?? evt.icon}
                </span>
                <div>
                  <h3 className="font-serif text-base font-semibold text-hunter-green">
                    {evt.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-gray">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon size={12} />
                      {new Date(evt.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon size={12} />
                      {evt.location}
                    </span>
                    {typeof evt.eventRank === 'number' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-paprika">
                        Rank #{evt.eventRank}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className="rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-graphite border border-light-gray">
                {evt.type}
              </span>
            </div>

            {evt.matches && evt.matches.length > 0 && (
              <div className="mt-3 grid gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-hunter-green">
                  <UsersIcon size={14} />
                  Matches ({evt.matches.length})
                </div>
                {evt.matches.map((match, idx) => (
                  <MatchScorecard key={idx} match={match} index={idx} />
                ))}
              </div>
            )}
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
            Tidak ada event yang cocok dengan filter kamu.
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-hunter-green px-5 py-2 text-sm font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            Load more events
          </button>
        </div>
      )}
    </section>
  );
}