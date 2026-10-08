import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import { cn } from '@/lib/utils';

export default function RoundHistory({
  gameData,
  className,
}: {
  gameData: FormulaCompletionGameData;
  className?: string;
}) {
  if (!gameData.history.length)
    return <p className="text-cdm-fg-muted text-xs">아직 결과가 없습니다.</p>;
  return (
    <ol className={cn('space-y-2', className)} aria-label="라운드 기록">
      {[...gameData.history].reverse().map((result) => (
        <li
          key={result.round}
          className="border-cdm-border bg-cdm-bg rounded-lg border p-2 text-xs"
        >
          <div className="flex justify-between gap-2">
            <b>
              {result.round}R ·{' '}
              {result.callerId ? gameData.players[result.callerId]?.nickname : '시간 초과'}
            </b>
            <span className="text-cdm-fg-muted">{result.reason}</span>
          </div>
          <p className="mt-1 font-semibold break-all tabular-nums">
            {result.expression || result.solution} = {result.evaluatedValue ?? result.target}
          </p>
          <div className="text-cdm-fg-muted mt-1 flex flex-wrap gap-x-3">
            {Object.entries(result.scoresAfter).map(([id, score]) => (
              <span key={id}>
                {gameData.players[id]?.nickname}{' '}
                {id === result.callerId
                  ? `${result.scoreDelta > 0 ? '+' : ''}${result.scoreDelta}`
                  : ''}{' '}
                ({score}점)
              </span>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
