'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/cdm/Card';
import { Board3D, BoardCell3D } from '@/components/game/abstract-strategy';
import { EskimoMarker, EskimoPiece } from '@/components/game/modules/eskimo/EskimoPiece';
import { eskimoMoveLabel } from '@/components/game/modules/eskimo/notation';
import { applyEskimoAction, createEskimoBoard, eskimoCellKey } from '@/shared/logic/eskimo';
import type { GameRecordFile } from '@/shared/types/archive';
import { ESKIMO_SIZE, type EskimoArchiveRecord, type EskimoBoard } from '@/shared/types/eskimo';
import { cn } from '@/lib/utils';

export default function EskimoViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as EskimoArchiveRecord | null;
  const [turnIndex, setTurnIndex] = useState<number | null>(null);
  const frames = useMemo(() => buildFrames(data), [data]);
  if (!data || !Array.isArray(data.actions) || frames.length === 0)
    return <p className="text-cdm-fg-muted text-sm">에스키모 기록을 읽을 수 없습니다.</p>;
  const selected = turnIndex == null ? frames.length - 1 : Math.min(turnIndex, frames.length - 1);
  const winner = data.winnerId ? data.players[data.winnerId]?.nickname : null;
  const lastFrame = selected === frames.length - 1;
  const moved = selected > 0 ? data.actions[selected - 1].action : null;
  const winKeys = new Set(lastFrame ? data.winCells.map(eskimoCellKey) : []);

  const nav = (label: string, to: number, disabled: boolean) => (
    <button
      type="button"
      onClick={() => setTurnIndex(to)}
      disabled={disabled}
      className="border-cdm-border rounded-cdm-md border px-3 py-2 text-xs font-bold disabled:opacity-30"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">ESKIMO</p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <p className="text-cdm-primary text-lg font-black">
            {winner ? `${winner} 승리` : '게임 종료'}
          </p>
        </div>
      </Card>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,32rem)_minmax(15rem,20rem)] lg:justify-center">
        <Card className="p-3">
          <Board3D
            columns={ESKIMO_SIZE}
            ariaLabel="에스키모 기록 판"
            maxWidth="30rem"
            density="compact"
          >
            {frames[selected].flatMap((row, r) =>
              row.map((piece, c) => {
                const key = `${r},${c}`;
                const isMoved =
                  moved != null &&
                  (eskimoCellKey(moved.from) === key || eskimoCellKey(moved.to) === key);
                return (
                  <BoardCell3D
                    key={key}
                    tone={(r + c) % 2 ? 'dark' : 'light'}
                    state={winKeys.has(key) ? 'highlight' : isMoved ? 'selected' : 'idle'}
                  >
                    {piece && <EskimoPiece piece={piece} firstPlayerId={data.firstPlayerId} />}
                  </BoardCell3D>
                );
              }),
            )}
          </Board3D>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {nav('처음', 0, selected === 0)}
            {nav('이전', Math.max(0, selected - 1), selected === 0)}
            <span className="text-cdm-fg-muted min-w-20 text-center text-xs font-bold">
              {selected} / {data.actions.length}턴
            </span>
            {nav('다음', Math.min(frames.length - 1, selected + 1), lastFrame)}
            {nav('마지막', frames.length - 1, lastFrame)}
          </div>
        </Card>
        <Card className="p-3">
          <p className="text-cdm-fg text-sm font-black">수순</p>
          <div className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto">
            {data.actions.map((entry, index) => (
              <button
                key={`${entry.turn}-${index}`}
                type="button"
                onClick={() => setTurnIndex(index + 1)}
                className={cn(
                  'rounded-cdm-md flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs',
                  selected === index + 1
                    ? 'bg-cdm-primary-soft text-cdm-primary'
                    : 'bg-cdm-bg-elev-1 text-cdm-fg-muted',
                )}
              >
                <b className="text-cdm-fg w-8 shrink-0">{entry.turn}T</b>
                <EskimoMarker
                  tone={entry.actorId === data.firstPlayerId ? 'primary' : 'highlight'}
                />
                <span className="text-cdm-fg truncate font-semibold">
                  {data.players[entry.actorId]?.nickname}
                </span>
                <span className="ml-auto shrink-0">{eskimoMoveLabel(entry)}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildFrames(data: EskimoArchiveRecord | null): EskimoBoard[] {
  if (!data?.actions || !data.firstPlayerId || !data.secondPlayerId) return [];
  const frames: EskimoBoard[] = [createEskimoBoard(data.firstPlayerId, data.secondPlayerId)];
  for (const entry of data.actions)
    frames.push(applyEskimoAction(frames[frames.length - 1], entry.action));
  return frames;
}
