'use client';

import { useMemo, useState } from 'react';
import { applyKingmakingAction, createKingmakingBoard } from '@/shared/logic/kingmaking';
import type { GameRecordFile } from '@/shared/types/archive';
import type { KingmakingArchiveRecord, KingmakingBoard } from '@/shared/types/kingmaking';
import { Card } from '@/components/cdm/Card';
import { Board3D, BoardCell3D } from '@/components/game/abstract-strategy';
import { cn } from '@/lib/utils';
import { StackVisual } from '@/components/game/modules/kingmaking/StackVisual';

export default function KingmakingViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as KingmakingArchiveRecord | null;
  const [turnIndex, setTurnIndex] = useState<number | null>(null);
  const frames = useMemo(() => buildFrames(data), [data]);
  if (!data || !Array.isArray(data.actions))
    return <p className="text-cdm-fg-muted text-sm">킹메이킹 기록을 읽을 수 없습니다.</p>;
  const selected = turnIndex == null ? frames.length - 1 : Math.min(turnIndex, frames.length - 1);
  const frame = frames[selected];
  const playerIds = Object.keys(data.players);
  const winner = data.winnerId ? data.players[data.winnerId]?.nickname : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">KINGMAKING</p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <p className="text-cdm-primary text-lg font-black">
            {winner ? `${winner} 승리` : '게임 종료'}
          </p>
        </div>
      </Card>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,32rem)_minmax(15rem,20rem)] lg:justify-center">
        <Card className="p-3">
          <ArchiveBoard board={frame} playerIds={playerIds} />
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setTurnIndex(0)}
              disabled={selected === 0}
              className="border-cdm-border rounded-cdm-md border px-3 py-2 text-xs font-bold disabled:opacity-30"
            >
              처음
            </button>
            <button
              type="button"
              onClick={() => setTurnIndex(Math.max(0, selected - 1))}
              disabled={selected === 0}
              className="border-cdm-border rounded-cdm-md border px-3 py-2 text-xs font-bold disabled:opacity-30"
            >
              이전
            </button>
            <span className="text-cdm-fg-muted min-w-20 text-center text-xs font-bold">
              {selected} / {data.actions.length}턴
            </span>
            <button
              type="button"
              onClick={() => setTurnIndex(Math.min(frames.length - 1, selected + 1))}
              disabled={selected === frames.length - 1}
              className="border-cdm-border rounded-cdm-md border px-3 py-2 text-xs font-bold disabled:opacity-30"
            >
              다음
            </button>
            <button
              type="button"
              onClick={() => setTurnIndex(frames.length - 1)}
              disabled={selected === frames.length - 1}
              className="border-cdm-border rounded-cdm-md border px-3 py-2 text-xs font-bold disabled:opacity-30"
            >
              마지막
            </button>
          </div>
        </Card>
        <Card className="p-3">
          <p className="text-cdm-fg text-sm font-black">행동 기록</p>
          <div className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto">
            {data.actions.map((entry, index) => (
              <button
                key={`${entry.turn}-${index}`}
                type="button"
                onClick={() => setTurnIndex(index + 1)}
                className={cn(
                  'rounded-cdm-md w-full px-2.5 py-2 text-left text-xs',
                  selected === index + 1
                    ? 'bg-cdm-primary-soft text-cdm-primary'
                    : 'bg-cdm-bg-elev-1 text-cdm-fg-muted',
                )}
              >
                <b className="text-cdm-fg mr-1">
                  {entry.turn}T · {data.players[entry.actorId]?.nickname}
                </b>
                {actionLabel(entry.action)}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildFrames(data: KingmakingArchiveRecord | null) {
  if (!data?.actions) return [createKingmakingBoard()];
  const frames: KingmakingBoard[] = [createKingmakingBoard()];
  let board = frames[0];
  for (const entry of data.actions) {
    board = applyKingmakingAction(
      board,
      entry.action,
      entry.action.type === 'place'
        ? { id: `archive:${entry.turn}`, ownerId: entry.actorId, kind: entry.action.kind }
        : undefined,
    );
    frames.push(board);
  }
  return frames;
}

function ArchiveBoard({ board, playerIds }: { board: KingmakingBoard; playerIds: string[] }) {
  return (
    <Board3D columns={5} ariaLabel="킹메이킹 기록 보드" maxWidth="30rem" density="compact">
      {board.flatMap((row, rowIndex) =>
        row.map((stack, colIndex) => (
          <BoardCell3D
            key={`${rowIndex}:${colIndex}`}
            tone={(rowIndex + colIndex) % 2 ? 'dark' : 'light'}
          >
            <StackVisual stack={stack} playerIds={playerIds} compact />
          </BoardCell3D>
        )),
      )}
    </Board3D>
  );
}

function actionLabel(action: KingmakingArchiveRecord['actions'][number]['action']) {
  if (action.type === 'place')
    return `${action.kind === 'special' ? '특수말' : '일반말'} 배치 (${action.to.row + 1}, ${action.to.col + 1})`;
  return `${action.count}층 이동 (${action.from.row + 1}, ${action.from.col + 1}) → (${action.to.row + 1}, ${action.to.col + 1})`;
}
