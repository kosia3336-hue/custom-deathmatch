import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import { cn } from '@/lib/utils';

export default function ScoreBoard({
  gameData,
  myId,
  className,
}: {
  gameData: FormulaCompletionGameData;
  myId: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-cdm-lg border-cdm-border bg-cdm-bg flex items-center justify-between gap-3 border px-3 py-2.5',
        className,
      )}
    >
      {Object.entries(gameData.players)
        .sort(([a], [b]) => Number(b === myId) - Number(a === myId))
        .map(([id, player], index) => (
          <div key={id} className={cn('min-w-0', index > 0 && 'text-right')}>
            <p
              className={cn(
                'text-cdm-fg-muted truncate text-xs',
                id === myId && 'text-cdm-primary font-semibold',
              )}
            >
              {player.nickname}
              {id === myId ? ' (나)' : ''}
              {gameData.isSolo ? ' · 솔로' : ''}
            </p>
            <p className="text-cdm-fg text-xl font-extrabold tabular-nums">
              {gameData.scores[id] ?? 0}점
            </p>
          </div>
        ))}
    </div>
  );
}
