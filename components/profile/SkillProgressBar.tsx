'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@/components/ui/Icons';
import type {
  SkillBreakdownItem,
  SkillDetailStat,
  SkillLevel,
} from '@/data/profile-types';

type Props = {
  item: SkillBreakdownItem;
  /** Allows the parent (SkillBreakdown) to override the primary value used in the bar. */
  valueOverride?: number;
  /**
   * Replaces `item.details` for the expanded sub-stat row. Used by the
   * profile "Skill Breakdown" panel to surface admin-assigned per-(user,
   * activity) sub-stat values when they exist; otherwise the static
   * `item.details` from `skillBreakdownDefaults` renders unchanged.
   */
  detailsOverride?: SkillDetailStat[];
  /**
   * When provided, overrides `item.level` so the badge reflects the
   * actual numeric value (0-100) instead of the static defaults. The
   * breakdown client computes the level via `levelFromValue`.
   */
  levelOverride?: SkillLevel;
};

/**
 * Map a 0-100 value to a skill level using the agreed thresholds:
 *   < 25        → Beginner
 *   < 50        → Intermediate
 *   < 75        → Advanced
 *   ≥ 75        → Expert
 */
export function levelFromValue(value: number): SkillLevel {
  if (value < 25) return 'Beginner';
  if (value < 50) return 'Intermediate';
  if (value < 75) return 'Advanced';
  return 'Expert';
}

/**
 * Single skill bar with internal expand/collapse state for the details row.
 * Pure UI — all values come from the `item` prop (and `valueOverride` /
 * `detailsOverride` / `levelOverride` if provided).
 */
export function SkillProgressBar({
  item,
  valueOverride,
  detailsOverride,
  levelOverride,
}: Props) {
  const [open, setOpen] = useState(false);
  const value = typeof valueOverride === 'number' ? valueOverride : item.details[0]?.value ?? 0;
  const clamped = Math.max(0, Math.min(100, value));
  const level = levelOverride ?? item.level;
  const details = detailsOverride ?? item.details;
  const levelColor =
    level === 'Expert'
      ? 'text-emerald-600 bg-emerald-100'
      : level === 'Advanced'
        ? 'text-sky-700 bg-sky-100'
        : level === 'Intermediate'
          ? 'text-amber-700 bg-amber-100'
          : 'text-rose-700 bg-rose-100';

  return (
    <div className="rounded-xl border border-light-gray bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${levelColor}`}
          >
            {level}
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
          {details.map((detail) => (
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
