'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { KnightTourCell, KnightTourGameData } from '@/shared/types/knights-tour';
import { useRoomStore } from '@/stores/room';

function cellKey(cell: KnightTourCell) {
  return `${cell.row}:${cell.col}`;
}

function isKnightMove(from: KnightTourCell, to: KnightTourCell) {
  const rowDistance = Math.abs(from.row - to.row);
  const colDistance = Math.abs(from.col - to.col);
  return (rowDistance === 1 && colDistance === 2) || (rowDistance === 2 && colDistance === 1);
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export default function KnightsTourGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as KnightTourGameData | undefined;
  const myId = useMySocketId();
  const [now, setNow] = useState(gameData?.roundStartedAt ?? 0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  const remaining = Math.max(
    0,
    Math.ceil((gameData.roundStartedAt + gameData.roundSeconds * 1000 - now) / 1000),
  );
  const entries = Object.entries(gameData.players);
  const isPlayer = Boolean(gameData.players[myId]);
  const hasSubmitted = Boolean(gameData.progress[myId]?.submitted);
  const result = gameData.lastRoundResult;
  const resultName = result?.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  const winningCount = result?.winnerId
    ? (result.visitedCounts[result.winnerId] ?? result.winningPath.length)
    : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-4">
      <header className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto] items-center gap-2 border p-2.5 sm:grid-cols-[1fr_auto_1fr] sm:p-3">
        <div className="min-w-0">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.18em]">
            ROUND {gameData.round} / {gameData.totalRounds}
          </p>
          <p className="text-cdm-fg truncate text-sm font-black">
            60초 동안 최대한 멀리 이동하세요
          </p>
          <p className="text-cdm-fg-muted hidden text-xs sm:block">
            원하는 때 제출할 수 있으며, 동률이면 먼저 제출한 플레이어가 승리합니다.
          </p>
        </div>
        <div className="bg-cdm-bg-elev-1 rounded-cdm-md min-w-20 px-3 py-1.5 text-center">
          <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-[0.14em]">TIME</p>
          <p
            className={cn(
              'text-cdm-fg text-xl font-black tabular-nums',
              remaining <= 10 && 'text-cdm-accent',
            )}
          >
            {formatClock(remaining)}
          </p>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:justify-end">
          {entries.map(([playerId, player]) => (
            <div
              key={playerId}
              className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-md min-w-0 border px-2.5 py-1.5 sm:min-w-24"
            >
              <p className="text-cdm-fg-muted truncate text-[11px] font-semibold">
                {player.nickname}
                {playerId === myId ? ' (나)' : ''}
              </p>
              <div className="flex items-end justify-between gap-2">
                <span className="text-cdm-fg-subtle text-[9px] font-bold">
                  {gameData.isSolo ? '누적 칸' : '승점'}
                </span>
                <span className="text-cdm-primary text-xl font-black tabular-nums">
                  {gameData.scores[playerId] ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 items-start gap-3 lg:grid-cols-[minmax(0,34rem)_minmax(15rem,19rem)] lg:justify-center">
        <TourBoard
          key={`${gameData.roundStartedAt}:${myId}`}
          gameData={gameData}
          myId={myId}
          canPlay={isPlayer && gameData.phase === 'playing' && !hasSubmitted}
          submitted={hasSubmitted}
        />
        <aside className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
          <p className="text-cdm-fg text-sm font-black">진행 상황</p>
          <div className="mt-3 space-y-3">
            {entries.map(([playerId, player]) => {
              const count = gameData.progress[playerId]?.visitedCount ?? 0;
              const total = gameData.board.activeCells.length;
              return (
                <div key={playerId}>
                  <div className="text-cdm-fg-muted mb-1 flex justify-between text-xs font-semibold">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{player.nickname}</span>
                      {gameData.progress[playerId]?.submitted && (
                        <span className="bg-cdm-success-soft text-cdm-success rounded-full px-1.5 text-[9px] font-black">
                          제출
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{count}칸</span>
                  </div>
                  <div className="bg-cdm-bg-elev-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-cdm-primary h-full rounded-full transition-[width] duration-200"
                      style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-cdm-border text-cdm-fg-muted mt-4 border-t pt-3 text-xs leading-5">
            <p>
              <span className="font-black">나이트 이동</span> · 가로 2칸 + 세로 1칸, 또는 가로 1칸 +
              세로 2칸
            </p>
            <p className="mt-1">방문한 칸은 다시 밟을 수 없습니다.</p>
            <p className="mt-1">검은 칸은 이동할 수 없는 구멍입니다.</p>
          </div>
        </aside>
      </div>

      {gameData.phase === 'round-result' && result && (
        <div
          className={cn(
            'rounded-cdm-lg p-3 text-center',
            result.winnerId ? 'bg-cdm-success-soft' : 'bg-cdm-accent-soft',
          )}
        >
          <p
            className={cn(
              'text-sm font-black',
              result.winnerId ? 'text-cdm-success' : 'text-cdm-accent',
            )}
          >
            {gameData.isSolo
              ? `${winningCount ?? 0}칸 기록을 제출했습니다.`
              : resultName
                ? `${resultName} 님이 ${winningCount ?? 0}칸으로 승리했습니다!`
                : '동일한 칸 수로 라운드가 무승부입니다.'}
          </p>
          <p className="text-cdm-fg-muted mt-0.5 text-xs">
            {result.reason === 'timeout'
              ? '1분 종료 시점의 경로를 제출 기록으로 사용했습니다.'
              : '제출 경로를 확인한 뒤 다음 라운드로 넘어갑니다.'}
          </p>
        </div>
      )}
      {!isPlayer && gameData.phase === 'playing' && (
        <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
      )}
      {gameData.phase === 'finished' && (
        <div className="bg-cdm-primary-soft rounded-cdm-lg p-4 text-center">
          <p className="text-cdm-primary text-sm font-black">{gameData.finishReason}</p>
        </div>
      )}
    </div>
  );
}

function TourBoard({
  gameData,
  myId,
  canPlay,
  submitted,
}: {
  gameData: KnightTourGameData;
  myId: string;
  canPlay: boolean;
  submitted: boolean;
}) {
  const serverPath = useMemo(() => gameData.progress[myId]?.path ?? [], [gameData.progress, myId]);
  const [path, setPath] = useState<KnightTourCell[]>(serverPath);

  useEffect(() => {
    setPath(serverPath);
  }, [serverPath]);

  const active = useMemo(
    () => new Set(gameData.board.activeCells.map(cellKey)),
    [gameData.board.activeCells],
  );
  const order = useMemo(() => {
    const resultPaths = Object.values(gameData.lastRoundResult?.paths ?? {}).sort(
      (first, second) => second.length - first.length,
    );
    const shownPath =
      gameData.phase === 'playing'
        ? path
        : ((gameData.lastRoundResult?.winningPath.length
            ? gameData.lastRoundResult.winningPath
            : (resultPaths[0] ?? gameData.lastRoundResult?.solution)) ?? []);
    return new Map(shownPath.map((cell, index) => [cellKey(cell), index + 1]));
  }, [gameData.lastRoundResult, gameData.phase, path]);
  const visited = useMemo(() => new Set(path.map(cellKey)), [path]);
  const current = path.at(-1);

  function move(cell: KnightTourCell) {
    if (!canPlay || visited.has(cellKey(cell)) || (current && !isKnightMove(current, cell))) return;
    setPath((value) => [...value, cell]);
    getSocket().emit('game:action', { type: 'move', ...cell });
  }

  function backtrack() {
    if (!canPlay || path.length === 0) return;
    setPath((value) => value.slice(0, -1));
    getSocket().emit('game:action', { type: 'backtrack' });
  }

  function reset() {
    if (!canPlay || path.length === 0) return;
    setPath([]);
    getSocket().emit('game:action', { type: 'reset' });
  }

  function submit() {
    if (!canPlay) return;
    getSocket().emit('game:action', { type: 'submit' });
  }

  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2.5 sm:p-3">
      <div
        className="mx-auto grid aspect-square w-[min(100%,60dvh)] max-w-[34rem] gap-1"
        style={{ gridTemplateColumns: `repeat(${gameData.board.size}, minmax(0, 1fr))` }}
        aria-label={`${gameData.board.size} 곱하기 ${gameData.board.size} 나이트 보드`}
      >
        {Array.from({ length: gameData.board.size ** 2 }, (_, index) => {
          const cell = {
            row: Math.floor(index / gameData.board.size),
            col: index % gameData.board.size,
          };
          const key = cellKey(cell);
          if (!active.has(key))
            return (
              <div
                key={key}
                role="img"
                aria-label={`${cell.row + 1}행 ${cell.col + 1}열, 이동할 수 없는 구멍`}
                className="bg-cdm-fg rounded-cdm-sm aspect-square opacity-80"
              />
            );
          const step = order.get(key);
          const isCurrent = canPlay && current && cellKey(current) === key;
          const isLegal = canPlay && !visited.has(key) && (!current || isKnightMove(current, cell));
          return (
            <button
              key={key}
              type="button"
              onClick={() => move(cell)}
              disabled={!isLegal}
              aria-label={`${cell.row + 1}행 ${cell.col + 1}열${step ? `, ${step}번째 방문` : ''}`}
              className={cn(
                'rounded-cdm-sm relative aspect-square min-w-0 border text-sm font-black tabular-nums transition-all sm:text-base',
                (cell.row + cell.col) % 2
                  ? 'bg-cdm-bg-elev-2 border-cdm-border'
                  : 'bg-cdm-bg-elev-1 border-cdm-border',
                step && 'border-cdm-primary/40 bg-cdm-primary-soft text-cdm-primary',
                isLegal &&
                  'border-cdm-primary hover:bg-cdm-primary-soft ring-cdm-primary/20 cursor-pointer ring-1 ring-inset',
                isCurrent && 'bg-cdm-primary border-cdm-primary text-white shadow-md',
                !isLegal && !step && 'cursor-default',
              )}
            >
              {isCurrent ? (
                <span className="text-[clamp(1rem,5vw,2rem)] leading-none">♞</span>
              ) : step ? (
                <span>{step}</span>
              ) : isLegal ? (
                <span className="bg-cdm-primary absolute inset-0 m-auto h-1.5 w-1.5 rounded-full opacity-60" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-cdm-fg-muted min-w-0 flex-1 basis-full text-xs font-semibold sm:basis-auto">
          {canPlay
            ? path.length
              ? `${path.length}칸 방문 · 더 이동하거나 제출하세요.`
              : '시작할 칸을 선택하세요.'
            : submitted && gameData.phase === 'playing'
              ? `${path.length}칸 제출 완료 · 상대를 기다리는 중입니다.`
              : gameData.phase === 'playing'
                ? '관전 중입니다.'
                : '제출 경로'}
        </p>
        <button
          type="button"
          onClick={backtrack}
          disabled={!canPlay || path.length === 0}
          className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md flex min-h-10 items-center gap-1.5 border px-3 text-xs font-black disabled:opacity-35"
        >
          <span className="text-base" aria-hidden="true">
            ↶
          </span>
          한 칸 취소
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!canPlay || path.length === 0}
          className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md flex min-h-10 items-center gap-1.5 border px-3 text-xs font-black disabled:opacity-35"
        >
          <span className="text-base" aria-hidden="true">
            ⟳
          </span>
          처음부터
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canPlay}
          className="bg-cdm-primary hover:bg-cdm-primary-strong rounded-cdm-md min-h-10 px-4 text-xs font-black text-white disabled:opacity-35"
        >
          {submitted ? '제출 완료' : `${path.length}칸 제출`}
        </button>
      </div>
    </section>
  );
}
