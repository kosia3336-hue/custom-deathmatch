'use client';

import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';
import type { GameRecordFile } from '@/shared/types/archive';
import type { FarewellFormulaArchiveRecord } from '@/shared/types/farewell-formula';

export default function FarewellFormulaViewer({
  record,
  className,
}: {
  record: GameRecordFile;
  className?: string;
}) {
  const data = record.gameRecord as FarewellFormulaArchiveRecord | null;
  if (!data || !Array.isArray(data.history) || !data.players || !data.finalScores) {
    return <p className="text-cdm-fg-muted text-sm">이별 공식 기록을 읽을 수 없습니다.</p>;
  }

  const players = Object.entries(data.players);
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card>
        <div
          className={cn(
            'items-center gap-4',
            record.playMode === 'solo' ? 'flex justify-between' : 'grid grid-cols-[1fr_auto_1fr]',
          )}
        >
          {players.map(([playerId, player], index) => (
            <div
              key={playerId}
              className={cn(
                'min-w-0',
                record.playMode !== 'solo' && 'row-start-1',
                record.playMode !== 'solo' &&
                  (index === 0 ? 'col-start-1' : 'col-start-3 text-right'),
              )}
            >
              <p className="text-cdm-fg truncate text-sm font-semibold">{player.nickname}</p>
              <p className="text-cdm-primary text-2xl font-black tabular-nums">
                {data.finalScores[playerId] ?? 0}
              </p>
            </div>
          ))}
          <div
            className={cn(
              'shrink-0 text-center',
              record.playMode !== 'solo' && 'col-start-2 row-start-1',
            )}
          >
            <p className="text-cdm-fg-subtle text-[10px] font-semibold tracking-wide">FORMAT</p>
            <p className="text-cdm-fg text-sm font-bold">7라운드 · 선착순</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {data.history.map((round) => {
          const caller = round.callerId ? data.players[round.callerId]?.nickname : null;
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <span className="bg-cdm-bg-elev-2 text-cdm-fg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {round.round}R
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-cdm-fg font-mono text-sm font-semibold break-all">
                      {round.source}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-bold',
                        round.outcome === 'correct'
                          ? 'bg-cdm-success-soft text-cdm-success'
                          : 'bg-cdm-highlight-soft text-cdm-highlight-strong',
                      )}
                    >
                      {round.outcome === 'correct' ? `${caller ?? '플레이어'} +1` : '시간 종료'}
                    </span>
                  </div>
                  <p className="text-cdm-fg-subtle mt-1 text-xs">이별 {round.goodbyeCount}회</p>
                  <p className="text-cdm-fg mt-2 font-mono text-base font-black break-all">
                    {round.correctedExpression}
                  </p>
                  {round.correctedExpression !== round.answerExpression && (
                    <p className="text-cdm-fg-muted mt-1 font-mono text-xs break-all">
                      다른 해답: {round.answerExpression}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
