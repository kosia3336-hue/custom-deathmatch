'use client';

import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';
import type { GameRecordFile } from '@/shared/types/archive';
import type { FormulaCompletionArchiveRecord } from '@/shared/types/formula-completion';

export default function FormulaCompletionViewer({
  record,
  className,
}: {
  record: GameRecordFile;
  className?: string;
}) {
  const data = record.gameRecord as FormulaCompletionArchiveRecord | null;
  if (!data || !Array.isArray(data.history)) {
    return <p className="text-sm text-cdm-fg-muted">수식완성N 기록을 읽을 수 없습니다.</p>;
  }

  const scoreEntries = Object.entries(data.players).map(([playerId, player]) => ({
    playerId,
    nickname: player.nickname,
    score: data.finalScores[playerId] ?? 0,
  }));

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {scoreEntries.map((entry, index) => (
            <div
              key={entry.playerId}
              className={cn(
                'row-start-1 min-w-0',
                index === 0 ? 'col-start-1' : 'col-start-3 text-right',
              )}
            >
              <p className="truncate text-sm font-semibold text-cdm-fg">{entry.nickname}</p>
              <p className="text-2xl font-black tabular-nums text-cdm-primary">{entry.score}</p>
            </div>
          ))}
          <div className="col-start-2 row-start-1 shrink-0 text-center">
            <p className="text-[10px] font-semibold tracking-wide text-cdm-fg-subtle">FORMAT</p>
            <p className="text-sm font-bold text-cdm-fg">N = {data.numberCount}</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {data.history.map((round) => {
          const caller = round.callerId ? data.players[round.callerId]?.nickname : null;
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cdm-bg-elev-2 text-xs font-bold text-cdm-fg-muted">
                  {round.round}R
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-cdm-fg">
                      Target {round.target}
                      <span className="ml-2 font-normal text-cdm-fg-muted">
                        [{round.numbers.join(', ')}]
                      </span>
                    </p>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold',
                      round.outcome === 'correct'
                        ? 'bg-cdm-success-soft text-cdm-success'
                        : round.outcome === 'wrong'
                          ? 'bg-cdm-accent-soft text-cdm-accent'
                          : 'bg-cdm-highlight-soft text-cdm-highlight-strong',
                    )}>
                      {round.outcome === 'correct' ? '정답 +1' : round.outcome === 'wrong' ? '오답 -1' : '시간 종료'}
                    </span>
                  </div>
                  {round.expression ? (
                    <p className="mt-2 break-all font-mono text-sm font-bold text-cdm-fg">
                      {caller}: {round.expression}
                      {round.evaluatedValue != null && (
                        <span className="font-sans font-normal text-cdm-fg-muted"> = {round.evaluatedValue}</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-cdm-fg-muted">제출 없음</p>
                  )}
                  <p className="mt-1 text-xs text-cdm-fg-subtle">
                    예시 해답: <span className="font-mono">{round.solution}</span>
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
