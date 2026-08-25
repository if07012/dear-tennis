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

/**
 * One match card inside a funmatch event.
 * Pure server component.
 */
export function MatchScorecard({ match, index }: Props) {
  return (
    <div className="relative rounded-lg border border-light-gray bg-off-white p-4">
      <span
        className={`match-result-indicator ${match.result}`}
        aria-label={`Result: ${RESULT_LABEL[match.result]}`}
      >
        {RESULT_LABEL[match.result]}
      </span>

      <div className="flex items-center justify-between gap-2 pr-20">
        <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
          Match {typeof index === 'number' ? index + 1 : ''}
        </span>
        {match.isDoubles && (
          <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-hunter-green">
            Doubles
          </span>
        )}
      </div>

      <p className="mt-2 font-serif text-xl font-semibold text-hunter-green">
        {match.score}
      </p>

      <p className="mt-1 text-xs text-dark-gray">
        vs <span className="font-semibold text-graphite">{match.opponent}</span>
      </p>

      {match.partners.length > 0 && (
        <p className="mt-1 text-xs text-dark-gray">
          With{' '}
          <span className="font-medium text-graphite">
            {match.partners.join(', ')}
          </span>
        </p>
      )}
    </div>
  );
}