import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import { cn } from '@/lib/utils';

interface Props {
  gameData: FormulaCompletionGameData;
  myId: string;
  remainingSeconds: number | null;
  className?: string;
}

export default function ScoreBoard({ gameData, myId, remainingSeconds, className }: Props) {
  const entries = Object.entries(gameData.players);
  if (gameData.isSolo) {
    const [entry] = entries;
    const [playerId, player] = entry ?? ['', { nickname: '플레이어' }];
    return (
      <div
        className={cn(
          'grid grid-cols-[1fr_auto] items-center gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg px-3 py-2.5 shadow-(--cdm-shadow-sm)',
          className,
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-cdm-primary">
            {player.nickname}{playerId === myId ? ' (나)' : ''} · 솔로
          </p>
          <p className="text-xl font-extrabold tabular-nums text-cdm-fg">
            {gameData.scores[playerId] ?? 0}점
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-cdm-fg">
            R{gameData.round}/{gameData.totalRounds}
          </span>
          <span
            className={cn(
              'rounded-full bg-cdm-bg-elev-2 px-2.5 py-0.5 text-xs font-bold tabular-nums text-cdm-fg-muted',
              remainingSeconds != null && remainingSeconds <= 10 && 'bg-cdm-accent-soft text-cdm-accent',
            )}
          >
            {remainingSeconds == null ? '∞' : `${remainingSeconds}s`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-cdm-lg border border-cdm-border bg-cdm-bg px-3 py-2.5 shadow-(--cdm-shadow-sm)',
        className,
      )}
    >
      {entries.map(([playerId, player], index) => (
        <div
          key={playerId}
          className={cn(
            'row-span-2 min-w-0 self-center',
            index === 0 ? 'col-start-1 row-start-1' : 'col-start-3 row-start-1 text-right',
          )}
        >
          <p className={cn('truncate text-xs text-cdm-fg-muted', playerId === myId && 'font-semibold text-cdm-primary')}>
            {player.nickname}{playerId === myId ? ' (나)' : ''}
          </p>
          <p className="text-xl font-extrabold tabular-nums text-cdm-fg">
            {gameData.scores[playerId] ?? 0}
          </p>
        </div>
      ))}

      <div className="col-start-2 row-start-1 row-span-1 flex flex-col items-center px-2">
        <span className="text-[10px] font-semibold tracking-wide text-cdm-fg-subtle">ROUND</span>
        <span className="text-sm font-bold tabular-nums text-cdm-fg">
          {gameData.round}/{gameData.totalRounds}
        </span>
      </div>

      <div
        className={cn(
          'col-start-2 row-start-2 rounded-full bg-cdm-bg-elev-2 px-2.5 py-0.5 text-xs font-bold tabular-nums text-cdm-fg-muted',
          remainingSeconds != null && remainingSeconds <= 10 && 'bg-cdm-accent-soft text-cdm-accent',
        )}
        aria-label={remainingSeconds == null ? '시간 제한 없음' : `${remainingSeconds}초 남음`}
      >
        {remainingSeconds == null ? '∞' : `${remainingSeconds}s`}
      </div>
    </div>
  );
}
