import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import { cn } from '@/lib/utils';

export default function ScoreBoard({ gameData, myId, className }: {
  gameData: FormulaCompletionGameData;
  myId: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg px-3 py-2.5', className)}>
      {Object.entries(gameData.players).map(([id, player], index) => (
        <div key={id} className={cn('min-w-0', index > 0 && 'text-right')}>
          <p className={cn('truncate text-xs text-cdm-fg-muted', id === myId && 'font-semibold text-cdm-primary')}>
            {player.nickname}{id === myId ? ' (나)' : ''}{gameData.isSolo ? ' · 솔로' : ''}
          </p>
          <p className="text-xl font-extrabold tabular-nums text-cdm-fg">{gameData.scores[id] ?? 0}점</p>
        </div>
      ))}
    </div>
  );
}
