'use client';

import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';
import type { GameRecordFile } from '@/shared/types/archive';
import type { KnightTourArchiveRecord, KnightTourCell } from '@/shared/types/knights-tour';

function key(cell: KnightTourCell) {
  return `${cell.row}:${cell.col}`;
}

export default function KnightsTourViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as KnightTourArchiveRecord | null;
  if (!data || !Array.isArray(data.rounds))
    return <p className="text-cdm-fg-muted text-sm">나이트의 여행 기록을 읽을 수 없습니다.</p>;
  const players = Object.entries(data.players);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">
              KNIGHT&apos;S TOUR
            </p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <div className="flex gap-4">
            {players.map(([id, player]) => (
              <div key={id} className="text-right">
                <p className="text-cdm-fg-muted text-xs font-semibold">{player.nickname}</p>
                <p className="text-cdm-primary text-2xl font-black tabular-nums">
                  {data.finalScores[id] ?? 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.rounds.map((round) => {
          const winner = round.result?.winnerId
            ? data.players[round.result.winnerId]?.nickname
            : null;
          const recordedPaths = Object.values(round.result?.paths ?? {}).sort(
            (first, second) => second.length - first.length,
          );
          const shownPath = round.result?.winningPath.length
            ? round.result.winningPath
            : (recordedPaths[0] ?? round.solution);
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">
                    ROUND {round.round} / {data.totalRounds}
                  </p>
                  <p className="text-cdm-fg mt-0.5 text-sm font-black">
                    {round.result ? (winner ? `${winner} 라운드 승리` : '라운드 무승부') : '미진행'}
                  </p>
                </div>
                {round.result?.elapsedMs != null && (
                  <p className="text-cdm-fg-muted text-xs font-bold tabular-nums">
                    {(round.result.elapsedMs / 1000).toFixed(1)}초
                  </p>
                )}
              </div>
              {round.result && (
                <div className="text-cdm-fg-muted mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {players.map(([playerId, player]) => (
                    <span key={playerId}>
                      <b className="text-cdm-fg">{player.nickname}</b>{' '}
                      {round.result?.visitedCounts?.[playerId] ?? 0}칸
                      {round.result?.submissionElapsedMs?.[playerId] != null &&
                        ` · ${(round.result.submissionElapsedMs[playerId] / 1000).toFixed(1)}초`}
                    </span>
                  ))}
                </div>
              )}
              <ArchiveBoard
                size={round.board.size}
                activeCells={round.board.activeCells}
                path={shownPath}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ArchiveBoard({
  size,
  activeCells,
  path,
}: {
  size: number;
  activeCells: KnightTourCell[];
  path: KnightTourCell[];
}) {
  const active = new Set(activeCells.map(key));
  const order = new Map(path.map((cell, index) => [key(cell), index + 1]));
  return (
    <div
      className="mx-auto grid aspect-square w-full max-w-sm gap-1"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: size ** 2 }, (_, index) => {
        const cell = { row: Math.floor(index / size), col: index % size };
        const cellKey = key(cell);
        if (!active.has(cellKey))
          return (
            <div
              key={cellKey}
              className="bg-cdm-fg rounded-cdm-sm aspect-square opacity-80"
              aria-label="이동할 수 없는 구멍"
            />
          );
        return (
          <div
            key={cellKey}
            className={cn(
              'border-cdm-border rounded-cdm-sm flex aspect-square items-center justify-center border text-xs font-black tabular-nums sm:text-sm',
              (cell.row + cell.col) % 2 ? 'bg-cdm-bg-elev-2' : 'bg-cdm-bg-elev-1',
              order.has(cellKey) && 'text-cdm-primary',
            )}
          >
            {order.get(cellKey)}
          </div>
        );
      })}
    </div>
  );
}
