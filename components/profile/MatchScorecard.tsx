import type { FunmatchMatch, MatchResult } from '@/data/profile-types';

type Props = {
  match: FunmatchMatch;
  index?: number;
};

const RESULT_LABEL: Record<MatchResult, string> = {
  win: 'Win',
  loss: 'Loss',
  draw: 'Draw',
};

const RESULT_CHIP: Record<MatchResult, string> = {
  win: 'bg-hunter-green/10 text-hunter-green',
  loss: 'bg-paprika/10 text-paprika',
  draw: 'bg-dark-gray/10 text-dark-gray',
};

const RESULT_BORDER: Record<MatchResult, string> = {
  win: 'border-l-hunter-green',
  loss: 'border-l-paprika',
  draw: 'border-l-dark-gray/40',
};

/**
 * One match row inside a funmatch event. Pure server component.
 *
 * Rendered as a dense table-style line so 10+ matches stay scannable in a
 * column-bound event card: a coloured left border + Win/Loss/Draw chip make
 * the result the first thing the eye lands on, then opponent + score.
 */
export function MatchScorecard({ match, index }: Props) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border border-l-4 border-light-gray bg-off-white px-3 py-2 text-sm ${RESULT_BORDER[match.result]}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-xs font-semibold text-dark-gray tabular-nums">
          {typeof index === 'number' ? index + 1 : ''}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${RESULT_CHIP[match.result]}`}
          aria-label={`Result: ${RESULT_LABEL[match.result]}`}
        >
          {RESULT_LABEL[match.result]}
        </span>
        <span className="flex-1" />
        <span className="shrink-0 font-mono text-sm font-semibold text-hunter-green tabular-nums">
          {match.score}
        </span>
        {match.isDoubles && (
          <span className="hidden shrink-0 rounded-full bg-hunter-green/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-hunter-green sm:inline">
            2v2
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-7 text-xs text-dark-gray">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray/70">
          vs
        </span>
        <span className="font-medium text-graphite">{match.opponent}</span>
        {match.partners.length > 0 && (
          <span className="text-dark-gray">
            · with {match.partners.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
