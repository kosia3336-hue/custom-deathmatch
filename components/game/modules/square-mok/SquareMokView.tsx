'use client';
import { memo, useEffect, useMemo, useState } from 'react';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameFeedback } from '@/components/game/GameFeedbackContext';
import { useGameAction } from '@/components/game/GameActionContext';
import GameLoading from '@/components/game/GameLoading';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import {
  Board3D,
  BoardCellButton3D,
  GamePiece3D,
  PlayerStrip,
} from '@/components/game/abstract-strategy';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { cn } from '@/lib/utils';
import { SQUARE_MOK_DECIDER_LABEL, squareMokCellKey } from '@/shared/logic/square-mok';
import {
  SQM_COLS,
  SQM_ROWS,
  type SquareMokCell,
  type SquareMokGameData,
  type SquareMokSquare,
} from '@/shared/types/square-mok';

/** 칸 이름 — 열 A~F, 행 1~5(위에서부터) */
function cellName(cell: SquareMokCell) {
  return `${String.fromCharCode(65 + cell.col)}${cell.row + 1}`;
}

function squareKey(square: SquareMokSquare) {
  return square.cells.map(squareMokCellKey).join('|');
}

function SquareMokView({ gameData, myId }: GameModuleViewProps<SquareMokGameData>) {
  useAbstractStrategyMoveSfx(gameData?.board);
  if (!gameData) return <GameLoading label="게임을 불러오는 중" />;
  return <PlaySurface gameData={gameData} myId={myId} />;
}

function PlaySurface({ gameData, myId }: { gameData: SquareMokGameData; myId: string }) {
  const sendAction = useGameAction();
  const { subscribeError } = useGameFeedback();
  const { setHud } = useRoomLayout();
  const { board, firstPlayerId, quota } = gameData;
  const finished = gameData.phase === 'finished';
  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && !finished && gameData.currentPlayerId === myId;

  /* 고른 칸 — 차례가 바뀌면 비운다. 정해진 개수를 다 고르면 '두기' 로 한 번에 낸다. */
  const inputKey = `${gameData.turnNumber}:${gameData.phase}:${myId}`;
  const [input, setInput] = useState<{ key: string; picked: SquareMokCell[]; pending: boolean }>({
    key: inputKey,
    picked: [],
    pending: false,
  });
  if (input.key !== inputKey) setInput({ key: inputKey, picked: [], pending: false });
  const picked = input.key === inputKey ? input.picked : [];
  const pending = input.key === inputKey && input.pending;
  const active = isMyTurn && !pending;

  /* 옆 칸에서 고른 정사각형을 판에 비춘다. 끝나면 이긴 쪽의 가장 넓은 정사각형을 기본으로. */
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const allSquares = useMemo(
    () =>
      Object.entries(gameData.scores).flatMap(([playerId, score]) =>
        score.squares.map((square) => ({ playerId, square })),
      ),
    [gameData.scores],
  );
  const focus =
    allSquares.find((s) => squareKey(s.square) === focusKey) ??
    (finished && gameData.winnerId
      ? allSquares.find((s) => s.playerId === gameData.winnerId)
      : undefined);
  const focusCells = useMemo(
    () => new Set(focus ? focus.square.cells.map(squareMokCellKey) : []),
    [focus],
  );

  useEffect(
    () => subscribeError(() => setInput((current) => ({ ...current, pending: false }))),
    [subscribeError],
  );

  useEffect(() => {
    setHud({
      round: `${gameData.turnNumber}턴`,
      order: finished
        ? '종료'
        : !isPlayer
          ? `(${gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어'} 차례)`
          : isMyTurn
            ? `(내 차례 · ${quota}개)`
            : '(상대 차례)',
    });
  }, [
    finished,
    gameData.currentPlayerId,
    gameData.players,
    gameData.turnNumber,
    isMyTurn,
    isPlayer,
    quota,
    setHud,
  ]);
  useEffect(() => () => setHud(null), [setHud]);

  const pickedKeys = new Set(picked.map(squareMokCellKey));
  const lastTurn = gameData.history.at(-1);
  const lastKeys = new Set(lastTurn ? lastTurn.cells.map(squareMokCellKey) : []);

  function toggle(cell: SquareMokCell) {
    if (!active || board[cell.row][cell.col] !== null) return;
    const key = squareMokCellKey(cell);
    setInput((current) => {
      if (current.picked.some((c) => squareMokCellKey(c) === key)) {
        return { ...current, picked: current.picked.filter((c) => squareMokCellKey(c) !== key) };
      }
      // 이미 다 골랐으면 가장 먼저 고른 칸을 빼고 새 칸을 넣는다
      const next = [...current.picked, cell];
      return { ...current, picked: next.slice(-quota) };
    });
  }

  function submit() {
    if (!active || picked.length !== quota) return;
    setInput((current) => ({ ...current, pending: true }));
    sendAction({ type: 'place', cells: picked });
  }

  const players = Object.entries(gameData.players).sort(([a], [b]) => {
    if (isPlayer) return Number(b === myId) - Number(a === myId);
    return Number(b === firstPlayerId) - Number(a === firstPlayerId);
  });
  const toneOf = (playerId: string) => (playerId === firstPlayerId ? 'primary' : 'highlight');

  const reference = (
    <SquareMokSidePanel
      gameData={gameData}
      focusKey={focus ? squareKey(focus.square) : null}
      onFocus={setFocusKey}
    />
  );

  const cells: SquareMokCell[] = [];
  for (let row = 0; row < SQM_ROWS; row += 1) {
    for (let col = 0; col < SQM_COLS; col += 1) cells.push({ row, col });
  }

  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;

  return (
    <GameReferenceFrame
      reference={reference}
      info={
        <PlayerStrip
          desktopVisible
          entries={players.map(([playerId, player]) => ({
            id: playerId,
            name: player.nickname,
            isMe: playerId === myId,
            marker: (
              <span className="block h-5 w-5 shrink-0">
                <GamePiece3D tone={toneOf(playerId)} />
              </span>
            ),
            detail: `${playerId === firstPlayerId ? '선' : '후'} · ${gameData.scores[playerId]?.points ?? 0}점`,
            active: !finished && gameData.currentPlayerId === playerId,
          }))}
        />
      }
      controls={
        isPlayer && !finished ? (
          <div className="flex items-center justify-center gap-2 px-2 py-1.5">
            {isMyTurn ? (
              <>
                <span className="text-cdm-fg text-xs font-bold tabular-nums">
                  {quota}개 놓기 · {picked.length}/{quota}
                </span>
                <button
                  type="button"
                  onClick={() => setInput((current) => ({ ...current, picked: [] }))}
                  disabled={!active || picked.length === 0}
                  className="rounded-cdm-md border-cdm-border text-cdm-fg-muted border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  다시 고르기
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!active || picked.length !== quota}
                  className="rounded-cdm-md bg-cdm-primary hover:bg-cdm-primary-strong px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  두기
                </button>
              </>
            ) : (
              <span className="text-cdm-fg-muted text-xs">상대가 {quota}개를 놓는 중…</span>
            )}
          </div>
        ) : undefined
      }
    >
      <div
        data-game-intrinsic-stage
        className="relative mx-auto flex w-full max-w-xl flex-col items-center"
      >
        <Board3D
          columns={SQM_COLS}
          rows={SQM_ROWS}
          ariaLabel="사각목 판"
          maxWidth="34rem"
          density="compact"
          fit
        >
          {cells.map((cell) => {
            const key = squareMokCellKey(cell);
            const owner = board[cell.row][cell.col];
            const isPicked = pickedKeys.has(key);
            const isFocus = focusCells.has(key);
            return (
              <BoardCellButton3D
                key={key}
                onClick={() => toggle(cell)}
                disabled={!active || owner !== null}
                aria-label={`${cellName(cell)} ${
                  owner
                    ? `${gameData.players[owner]?.nickname ?? ''}의 말`
                    : isPicked
                      ? '고른 칸'
                      : '빈칸'
                }`}
                tone="plain"
                state={isFocus ? 'highlight' : isPicked ? 'selected' : 'idle'}
                className={cn(!active && 'cursor-default')}
              >
                {(owner || isPicked) && (
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-[14%]',
                      isPicked && !owner && 'opacity-55',
                    )}
                  >
                    <GamePiece3D tone={toneOf(owner ?? myId)} selected={isPicked} />
                  </span>
                )}
                {owner && lastKeys.has(key) && !isFocus && (
                  <span className="border-cdm-primary/60 pointer-events-none absolute inset-[6%] rounded-md border-2 border-dashed" />
                )}
              </BoardCellButton3D>
            );
          })}
        </Board3D>

        {finished && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className="border-cdm-primary bg-cdm-bg/95 rounded-cdm-lg pointer-events-auto max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
              <p className="text-cdm-primary text-base font-black">
                {winnerName ? `${winnerName} 승리!` : '무승부'}
              </p>
              {gameData.decider && (
                <p className="text-cdm-fg mt-1 text-xs font-bold">
                  {SQUARE_MOK_DECIDER_LABEL[gameData.decider]}
                </p>
              )}
              <p className="text-cdm-fg-muted mt-1 text-xs tabular-nums">
                {players
                  .map(
                    ([playerId, player]) =>
                      `${player.nickname} ${gameData.scores[playerId]?.points ?? 0}점`,
                  )
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}
      </div>
    </GameReferenceFrame>
  );
}

const SquareMokSidePanel = memo(function SquareMokSidePanel({
  gameData,
  focusKey,
  onFocus,
}: {
  gameData: SquareMokGameData;
  focusKey: string | null;
  onFocus: (key: string | null) => void;
}) {
  const ids = Object.keys(gameData.players).sort(
    (a, b) => Number(b === gameData.firstPlayerId) - Number(a === gameData.firstPlayerId),
  );
  return (
    <GameInfoStack>
      <GameInfoPart title="정사각형" kind="score">
        <div className="flex flex-col gap-3">
          {ids.map((playerId) => {
            const score = gameData.scores[playerId];
            return (
              <section key={playerId} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="block h-4 w-4 shrink-0">
                    <GamePiece3D
                      tone={playerId === gameData.firstPlayerId ? 'primary' : 'highlight'}
                    />
                  </span>
                  <span className="text-cdm-fg truncate font-bold">
                    {gameData.players[playerId]?.nickname}
                  </span>
                  <span className="text-cdm-fg ml-auto font-black tabular-nums">
                    {score?.points ?? 0}점
                  </span>
                </div>
                <p className="text-cdm-fg-muted text-[11px] tabular-nums">
                  최대 {score?.maxArea ?? 0} · 육목 {score?.lines.six ?? 0} · 오목{' '}
                  {score?.lines.five ?? 0} · 사목 {score?.lines.four ?? 0}
                </p>
                {score && score.squares.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {score.squares.map((square) => {
                      const key = squareKey(square);
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => onFocus(focusKey === key ? null : key)}
                            title={square.cells.map(cellName).join('·')}
                            className={cn(
                              'rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                              focusKey === key
                                ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                                : 'border-cdm-border text-cdm-fg-muted',
                            )}
                          >
                            {square.area}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-cdm-fg-subtle text-[11px]">아직 정사각형이 없습니다.</p>
                )}
              </section>
            );
          })}
        </div>
      </GameInfoPart>
      <GameInfoPart title="기록" kind="history">
        {gameData.history.length === 0 ? (
          <p className="text-cdm-fg-muted text-xs">아직 놓은 말이 없습니다.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {[...gameData.history].reverse().map((entry) => (
              <li
                key={entry.turn}
                className="bg-cdm-bg-elev-1 text-cdm-fg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
              >
                <span className="text-cdm-fg w-8 shrink-0 font-black tabular-nums">
                  {entry.turn}T
                </span>
                <span className="block h-4 w-4 shrink-0">
                  <GamePiece3D
                    tone={entry.actorId === gameData.firstPlayerId ? 'primary' : 'highlight'}
                  />
                </span>
                <span className="text-cdm-fg truncate font-semibold">
                  {gameData.players[entry.actorId]?.nickname}
                </span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {entry.cells.map(cellName).join(', ')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </GameInfoPart>
    </GameInfoStack>
  );
});

export default memo(SquareMokView);
