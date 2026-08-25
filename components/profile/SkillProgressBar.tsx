'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@/components/ui/Icons';
import type { SkillBreakdownItem } from '@/data/profile-types';

type Props = {
  item: SkillBreakdownItem;
  /** Allows the parent (SkillBreakdown) to override the primary value used in the bar. */
  valueOverride?: number;
};

/**
 * Single skill bar with internal expand/collapse state for the details row.
 * Pure UI — all values come from the `item` prop (and `valueOverride` if provided).
 */
export function SkillProgressBar({ item, valueOverride }: Props) {
  const [open, setOpen] = useState(false);
  const value = typeof valueOverride === 'number' ? valueOverride : item.details[0]?.value ?? 0;
  const clamped = Math.max(0, Math.min(100, value));
  const levelColor =
    item.level === 'Expert'
      ? 'text-emerald-600 bg-emerald-100'
      : item.level === 'Advanced'
        ? 'text-sky-700 bg-sky-100'
        : item.level === 'Intermediate'
          ? 'text-amber-700 bg-amber-100'
          : 'text-rose-700 bg-rose-100';

  return (
    <div className="rounded-xl border border-light-gray bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${levelColor}`}
          >
            {item.level}
          </span>
          <h3 className="font-serif text-lg font-semibold text-hunter-green">
            {item.skill}
          </h3>
        </div>
        <span className="font-mono text-sm font-bold text-graphite">
          {clamped}
          <span className="text-xs text-dark-gray">/100</span>
        </span>
      </div>

      <p className="mt-2 text-sm text-dark-gray">{item.description}</p>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-light-gray">
        <div
          className={`skill-bar-fill h-full rounded-full bg-gradient-to-r ${item.gradient} transition-all duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
          aria-label={`${item.skill} progress`}
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:text-paprika"
      >
        {open ? 'Hide details' : 'Show details'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <div className="skill-bar-details" data-open={open ? 'true' : 'false'}>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-light-gray pt-3">
          {item.details.map((detail) => (
            <div
              key={detail.label}
              className="rounded-lg bg-off-white px-3 py-2 text-center"
            >
              <span className="block font-mono text-base font-bold text-hunter-green">
                {detail.value}
              </span>
              <span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                {detail.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}