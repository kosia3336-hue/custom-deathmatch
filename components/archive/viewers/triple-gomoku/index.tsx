'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/cdm/Card';
import { TripleGomokuBoardView } from '@/components/game/modules/triple-gomoku/BoardView';
import { cn } from '@/lib/utils';
import { applyTripleGomokuAction, tripleGomokuCellKey } from '@/shared/logic/triple-gomoku';
import type { GameRecordFile } from '@/shared/types/archive';
import type {
  TripleGomokuArchiveRecord,
  TripleGomokuBoard,
  TripleGomokuCell,
} from '@/shared/types/triple-gomoku';

const WIN_LABEL: Record<string, string> = {
  line: '오목 완성',
  'top-count': '3층 돌 다섯 개',
  'top-cluster': '붙어 있는 3층 돌 세 개',
  timeout: '제한시간 초과',
  'no-action': '둘 수 없음',
  forfeit: '기권',
};

/** 행동 기록을 처음부터 다시 적용해 턴별 판을 만든다. */
function buildFrames(data: TripleGomokuArchiveRecord | null): TripleGomokuBoard[] {
  const frames: TripleGomokuBoard[] = [{}];
  if (!data?.actions) return frames;
  let board: TripleGomokuBoard = {};
  for (const entry of data.actions) {
    board = applyTripleGomokuAction(board, entry.action, entry.actorId);
    frames.push(board);
  }
  return frames;
}

function actionLabel(action: TripleGomokuArchiveRecord['actions'][number]['action']) {
  const at = (cell: TripleGomokuCell) => `(${cell.q}, ${cell.r})`;
  return action.type === 'place'
    ? `놓기 ${at(action.to)}`
    : `이동 ${at(action.from)} → ${at(action.to)}`;
}

export default function TripleGomokuViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as TripleGomokuArchiveRecord | null;
  const [turnIndex, setTurnIndex] = useState<number | null>(null);
  const frames = useMemo(() => buildFrames(data), [data]);

  if (!data || !Array.isArray(data.actions)) {
    return <p className="text-cdm-fg-muted text-sm">삼층 오목 기록을 읽을 수 없습니다.</p>;
  }

  const selected = turnIndex == null ? frames.length - 1 : Math.min(turnIndex, frames.length - 1);
  const board = frames[selected];
  const players = Object.entries(data.players);
  const winner = data.winnerId ? data.players[data.winnerId]?.nickname : null;
  const isFinal = selected === frames.length - 1;
  const winKeys = new Set(data.winCells.map(tripleGomokuCellKey));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">TRIPLE GOMOKU</p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <div className="text-right">
            <p className="text-cdm-primary text-lg font-black">
              {winner ? `${winner} 승리` : '게임 종료'}
            </p>
            {data.winType && (
              <p className="text-cdm-fg-muted text-xs font-bold">
                {WIN_LABEL[data.winType] ?? data.winType}
              </p>
            )}
          </div>
        </div>
        <div className="text-cdm-fg-muted mt-3 flex flex-wrap gap-4 text-xs">
          {players.map(([playerId, player]) => (
            <span key={playerId}>
              <span className="text-cdm-fg font-bold">{player.nickname}</span> · 남은 돌{' '}
              <span className="tabular-nums">{data.finalReserves[playerId] ?? 0}</span>
            </span>
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,38rem)_minmax(15rem,20rem)] lg:justify-center">
        <Card className="p-3">
          <TripleGomokuBoardView
            board={board}
            firstPlayerId={data.firstPlayerId}
            markOf={(cell) => (isFinal && winKeys.has(tripleGomokuCellKey(cell)) ? 'win' : 'none')}
            ariaLabel="삼층 오목 기록 판"
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
            <span className="text-cdm-fg-muted min-w-20 text-center text-xs font-bold tabular-nums">
              {selected} / {data.actions.length}수
            </span>
            <button
              type="button"
              onClick={() => setTurnIndex(Math.min(frames.length - 1, selected + 1))}
              disabled={isFinal}
              className="border-cdm-border rounded-cdm-md border px-3 py-2 text-xs font-bold disabled:opacity-30"
            >
              다음
            </button>
            <button
              type="button"
              onClick={() => setTurnIndex(frames.length - 1)}
              disabled={isFinal}
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
                  {index + 1}. {data.players[entry.actorId]?.nickname ?? '플레이어'}
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
