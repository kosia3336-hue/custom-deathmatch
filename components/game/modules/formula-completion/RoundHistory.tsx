import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import { cn } from '@/lib/utils';

interface Props {
  gameData: FormulaCompletionGameData;
  className?: string;
}

export default function RoundHistory({ gameData, className }: Props) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5', className)} aria-label="라운드 진행 기록">
      {Array.from({ length: gameData.totalRounds }, (_, index) => {
        const round = index + 1;
        const result = gameData.history[index];
        return (
          <span
            key={round}
            title={result ? `${round}R ${result.reason}` : `${round}라운드`}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums',
              round === gameData.round && gameData.phase === 'playing'
                ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                : result?.outcome === 'correct'
                  ? 'border-cdm-success bg-cdm-success-soft text-cdm-success'
                  : result?.outcome === 'wrong'
                    ? 'border-cdm-accent bg-cdm-accent-soft text-cdm-accent'
                    : result?.outcome === 'timeout'
                      ? 'border-cdm-highlight bg-cdm-highlight-soft text-cdm-highlight-strong'
                      : 'border-cdm-border bg-cdm-bg text-cdm-fg-subtle',
            )}
          >
            {round}
          </span>
        );
      })}
    </div>
  );
}
