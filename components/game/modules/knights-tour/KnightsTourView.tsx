'use client';
import { memo } from 'react';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameAction } from '@/components/game/GameActionContext';

import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { KnightTourCell, KnightTourGameData } from '@/shared/types/knights-tour';
import { fitBoardWidth } from '@/components/game/GameFrame';
import { GamePlayerScoreboard } from '@/components/game/GamePlayerScoreboard';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';

function cellKey(cell: KnightTourCell) {
  return `${cell.row}:${cell.col}`;
}

function isKnightMove(from: KnightTourCell, to: KnightTourCell) {
  const rowDistance = Math.abs(from.row - to.row);
  const colDistance = Math.abs(from.col - to.col);
  return (rowDistance === 1 && colDistance === 2) || (rowDistance === 2 && colDistance === 1);
}

function KnightsTourView({
  gameData,
  myId,
}: GameModuleViewProps<KnightTourGameData> & { isSolo?: boolean }) {
  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  /* 라운드가 바뀌면 그리던 경로를 비운다. */
  return <TourRound key={`${gameData.roundStartedAt}:${myId}`} gameData={gameData} myId={myId} />;
}

function TourRound({ gameData, myId }: { gameData: KnightTourGameData; myId: string }) {
  const sendAction = useGameAction();
  // 첫 값은 라운드 시작 시각. 렌더 중에 Date.now() 를 부르면 순수하지 않다.
  const { setHud } = useRoomLayout();

  const serverPath = useMemo(() => gameData.progress[myId]?.path ?? [], [gameData.progress, myId]);
  const [path, setPath] = useState<KnightTourCell[]>(serverPath);
  useEffect(() => {
    setPath(serverPath);
  }, [serverPath]);

  const isPlayer = Boolean(gameData.players[myId]);
  const submitted = Boolean(gameData.progress[myId]?.submitted);
  const canPlay = isPlayer && gameData.phase === 'playing' && !submitted;
  const result = gameData.lastRoundResult;
  const resultName = result?.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  const winningCount = result?.winnerId
    ? (result.visitedCounts[result.winnerId] ?? result.winningPath.length)
    : null;
  const sidePanel = <TourScore gameData={gameData} myId={myId} />;

  useEffect(() => {
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order:
        gameData.phase === 'playing'
          ? gameData.isSolo
            ? '경로 탐색'
            : '(공동 차례) 경로 탐색'
          : gameData.phase === 'finished'
            ? '종료'
            : '라운드 결과',
    });
    return () => setHud(null);
  }, [gameData, setHud]);

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
    sendAction({ type: 'move', ...cell });
  }

  function backtrack() {
    if (!canPlay || path.length === 0) return;
    setPath((value) => value.slice(0, -1));
    sendAction({ type: 'backtrack' });
  }

  function reset() {
    if (!canPlay || path.length === 0) return;
    setPath([]);
    sendAction({ type: 'reset' });
  }

  function submit() {
    if (!canPlay) return;
    sendAction({ type: 'submit' });
  }

  const size = gameData.board.size;
  const overlay =
    gameData.phase === 'finished'
      ? { tone: 'primary' as const, title: gameData.finishReason, note: null as string | null }
      : gameData.phase === 'round-result' && result
        ? {
            tone: result.winnerId ? ('success' as const) : ('accent' as const),
            title: gameData.isSolo
              ? `${winningCount ?? 0}칸 기록을 제출했습니다.`
              : resultName
                ? `${resultName} 님이 ${winningCount ?? 0}칸으로 승리했습니다!`
                : '동일한 칸 수로 라운드가 무승부입니다.',
            note:
              result.reason === 'timeout'
                ? '1분 종료 시점의 경로를 제출 기록으로 사용했습니다.'
                : '제출 경로를 확인한 뒤 다음 라운드로 넘어갑니다.',
          }
        : null;

  return (
    <>
      <GameReferenceFrame
        controls={
          <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2">
            <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-1.5">
              <button
                type="button"
                onClick={backtrack}
                disabled={!canPlay || path.length === 0}
                className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md min-h-11 border px-1 text-[11px] font-black disabled:opacity-35"
              >
                ↶ 한 칸
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={!canPlay || path.length === 0}
                className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md min-h-11 border px-1 text-[11px] font-black disabled:opacity-35"
              >
                ⟳ 처음부터
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canPlay}
                className="bg-cdm-primary hover:bg-cdm-primary-strong rounded-cdm-md min-h-11 px-2 text-[11px] font-black text-white disabled:opacity-35"
              >
                {submitted ? '제출 완료' : `${path.length}칸 제출`}
              </button>
            </div>
            <p className="text-cdm-fg-muted mt-1.5 flex min-h-6 items-center justify-center text-center text-[11px]">
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
          </div>
        }
        reference={sidePanel}
      >
        <div
          className="mx-auto grid aspect-square w-full gap-1"
          style={{
            maxWidth: fitBoardWidth(size, size, '34rem'),
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          }}
          aria-label={`${size} 곱하기 ${size} 나이트 보드`}
        >
          {Array.from({ length: size ** 2 }, (_, index) => {
            const cell = { row: Math.floor(index / size), col: index % size };
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
            const isLegal =
              canPlay && !visited.has(key) && (!current || isKnightMove(current, cell));
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

        {overlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div
              className={cn(
                'rounded-cdm-lg bg-cdm-bg/95 max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur',
                overlay.tone === 'success'
                  ? 'border-cdm-success'
                  : overlay.tone === 'accent'
                    ? 'border-cdm-accent'
                    : 'border-cdm-primary',
              )}
            >
              <p
                className={cn(
                  'text-sm font-black',
                  overlay.tone === 'success'
                    ? 'text-cdm-success'
                    : overlay.tone === 'accent'
                      ? 'text-cdm-accent'
                      : 'text-cdm-primary',
                )}
              >
                {overlay.title}
              </p>
              {overlay.note && <p className="text-cdm-fg-muted mt-1 text-xs">{overlay.note}</p>}
            </div>
          </div>
        )}
      </GameReferenceFrame>
    </>
  );
}

function TourScore({ gameData, myId }: { gameData: KnightTourGameData; myId: string }) {
  return (
    <GameInfoPart title="점수" kind="score" sizeToContent>
      <GamePlayerScoreboard
        myId={myId}
        entries={Object.entries(gameData.players).map(([id, player]) => ({
          id,
          nickname: player.nickname,
          value: `${gameData.scores[id] ?? 0}점`,
        }))}
      />
    </GameInfoPart>
  );
}

export default memo(KnightsTourView);
