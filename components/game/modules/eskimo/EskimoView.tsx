'use client';
import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameFeedback } from '@/components/game/GameFeedbackContext';
import { useGameAction } from '@/components/game/GameActionContext';
import GameLoading from '@/components/game/GameLoading';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import {
  Board3D,
  BoardCellButton3D,
  PlayerStrip,
  usePlacementConfirm,
} from '@/components/game/abstract-strategy';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { cn } from '@/lib/utils';
import { eskimoCellKey, eskimoLegalTargets, eskimoMoveTargets } from '@/shared/logic/eskimo';
import {
  ESKIMO_BEAR,
  ESKIMO_SIZE,
  type EskimoCell,
  type EskimoGameData,
} from '@/shared/types/eskimo';
import { EskimoMarker, EskimoPiece } from './EskimoPiece';
import { EskimoBearStatus } from './EskimoBearStatus';
import boardStyles from './eskimo-board.module.css';
import { getEskimoSlide, eskimoSlideOffset, type EskimoSlide } from './movement';
import { ESKIMO_WIN_HINT, eskimoCellName, eskimoMoveLabel } from './notation';

function EskimoView({ gameData, myId }: GameModuleViewProps<EskimoGameData>) {
  useAbstractStrategyMoveSfx(gameData?.board);
  // Track confirmed moves without remounting the board or its docked panels each turn.
  const [movement, setMovement] = useState<{
    snapshot: EskimoGameData | null;
    slide: EskimoSlide | null;
  }>({ snapshot: gameData ?? null, slide: null });
  if (movement.snapshot !== (gameData ?? null)) {
    const sameMove =
      gameData &&
      movement.snapshot &&
      gameData.turnNumber === movement.snapshot.turnNumber &&
      gameData.lastAction?.turn === movement.snapshot.lastAction?.turn &&
      gameData.board.every((row, r) =>
        row.every((piece, c) => piece === movement.snapshot?.board[r][c]),
      );
    setMovement({
      snapshot: gameData ?? null,
      slide: gameData
        ? sameMove
          ? movement.slide
          : getEskimoSlide(movement.snapshot, gameData)
        : null,
    });
  }
  const slide = movement.slide;
  const finishSlide = () =>
    setMovement((current) => (current.slide === slide ? { ...current, slide: null } : current));
  useEffect(() => {
    if (!slide) return;
    // Fallback when an interrupted CSS animation does not dispatch animationend.
    const timer = setTimeout(
      () =>
        setMovement((current) => (current.slide === slide ? { ...current, slide: null } : current)),
      slide.durationMs + 100,
    );
    return () => clearTimeout(timer);
  }, [slide]);

  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase !== 'finished';

  return (
    <PlaySurface
      gameData={gameData}
      myId={myId}
      isPlayer={isPlayer}
      isMyTurn={isMyTurn}
      slide={slide}
      onSlideEnd={finishSlide}
    />
  );
}

function PlaySurface({
  gameData,
  myId,
  isPlayer,
  isMyTurn,
  slide,
  onSlideEnd,
}: {
  gameData: EskimoGameData;
  myId: string;
  isPlayer: boolean;
  isMyTurn: boolean;
  slide: EskimoSlide | null;
  onSlideEnd: () => void;
}) {
  const sendAction = useGameAction();
  const { subscribeError } = useGameFeedback();
  const { setHud } = useRoomLayout();
  const inputKey = `${gameData.turnNumber}:${gameData.phase}:${myId}`;
  const [input, setInput] = useState<{ key: string; source: EskimoCell | null; pending: boolean }>({
    key: inputKey,
    source: null,
    pending: false,
  });
  // Reset turn input before painting, while preserving board DOM, size and panel registrations.
  if (input.key !== inputKey) setInput({ key: inputKey, source: null, pending: false });
  const source = input.key === inputKey ? input.source : null;
  const pending = input.key === inputKey && input.pending;
  const placement = usePlacementConfirm(`${inputKey}:${source ? eskimoCellKey(source) : ''}`);

  const { board, firstPlayerId } = gameData;
  const finished = gameData.phase === 'finished';
  const bearLocked = gameData.bearLockTurns > 0;
  const active = isMyTurn && !pending && !slide;
  /* 후 플레이어는 판을 돌려 내 말이 아래에 오게 본다. 관전자는 선 쪽에서 본다. */
  const flip = isPlayer && myId !== firstPlayerId;
  const offset = slide ? eskimoSlideOffset(slide, flip) : null;

  useEffect(() => {
    setHud({
      round: `${gameData.turnNumber}턴`,
      order: finished
        ? '종료'
        : !isPlayer
          ? `(${gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어'} 차례)`
          : isMyTurn
            ? '(내 차례)'
            : '(상대 차례)',
    });
  }, [
    finished,
    gameData.currentPlayerId,
    gameData.players,
    gameData.turnNumber,
    isMyTurn,
    isPlayer,
    setHud,
  ]);

  /* 거부된 수만 입력 잠금을 푼다. */
  useEffect(
    () => subscribeError(() => setInput((current) => ({ ...current, pending: false }))),
    [subscribeError],
  );

  /* 지금까지 나온 판 — 반복수가 되는 칸은 고를 수 없다(서버도 받지 않는다). */
  const positions = useMemo(() => new Set(gameData.positions ?? []), [gameData.positions]);
  const legalTargets = (from: EskimoCell) =>
    eskimoLegalTargets(board, from, myId, bearLocked, firstPlayerId, positions);
  const targets = useMemo(
    () =>
      source ? eskimoLegalTargets(board, source, myId, bearLocked, firstPlayerId, positions) : [],
    [board, bearLocked, firstPlayerId, myId, positions, source],
  );
  const targetKeys = useMemo(() => new Set(targets.map(eskimoCellKey)), [targets]);
  /* 미끄러져 닿긴 하지만 반복수라 막힌 칸 — 왜 못 가는지 ✕ 로 보여 준다. */
  const repeatKeys = useMemo(() => {
    if (!source) return new Set<string>();
    return new Set(
      eskimoMoveTargets(board, source, myId, bearLocked)
        .map(eskimoCellKey)
        .filter((key) => !targetKeys.has(key)),
    );
  }, [bearLocked, board, myId, source, targetKeys]);
  const winKeys = useMemo(() => new Set(gameData.winCells.map(eskimoCellKey)), [gameData.winCells]);
  const last = gameData.lastAction?.action ?? null;

  function canPick(cell: EskimoCell) {
    const piece = board[cell.row][cell.col];
    if (piece !== myId && piece !== ESKIMO_BEAR) return false;
    return legalTargets(cell).length > 0;
  }

  function handleClick(cell: EskimoCell) {
    if (!active) return;
    const key = eskimoCellKey(cell);
    if (source && targetKeys.has(key)) {
      const from = source;
      placement.tap(key, () => {
        setInput((current) => ({ ...current, pending: true }));
        sendAction({ type: 'move', from, to: cell });
      });
      return;
    }
    if (canPick(cell)) {
      placement.clear();
      setInput({
        key: inputKey,
        pending: false,
        source: source && eskimoCellKey(source) === key ? null : cell,
      });
    }
  }

  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;

  useEffect(() => () => setHud(null), [setHud]);

  const reference = useMemo(() => <EskimoSidePanel gameData={gameData} />, [gameData]);

  const players = orderedPlayers(gameData, myId);

  const cells: EskimoCell[] = [];
  for (let r = 0; r < ESKIMO_SIZE; r += 1) {
    for (let c = 0; c < ESKIMO_SIZE; c += 1) {
      cells.push(
        flip ? { row: ESKIMO_SIZE - 1 - r, col: ESKIMO_SIZE - 1 - c } : { row: r, col: c },
      );
    }
  }

  return (
    <GameReferenceFrame
      reference={reference}
      info={
        <div className={cn('flex flex-col gap-2', boardStyles.turnPalette)}>
          <PlayerStrip
            desktopVisible
            className={boardStyles.playerStrip}
            entries={players.map(([playerId, player]) => ({
              id: playerId,
              name: player.nickname,
              isMe: playerId === myId,
              marker: <EskimoMarker tone={playerId === firstPlayerId ? 'primary' : 'highlight'} />,
              detail: playerId === firstPlayerId ? '선' : '후',
              active: !finished && gameData.currentPlayerId === playerId,
            }))}
          />
          <div className="flex items-center justify-center gap-2 py-0.5">
            <span className="text-cdm-fg flex items-center gap-1.5 text-[11px] font-bold">
              <EskimoMarker tone="bear" /> 북극곰
            </span>
            <EskimoBearStatus lockTurns={gameData.bearLockTurns} />
          </div>
        </div>
      }
    >
      <div
        data-game-intrinsic-stage
        className={cn('mx-auto flex w-full max-w-xl flex-col items-center', boardStyles.board)}
      >
        <Board3D
          columns={ESKIMO_SIZE}
          ariaLabel="에스키모 판"
          maxWidth="34rem"
          density="compact"
          gridClassName={boardStyles.grid}
          fit
        >
          {cells.map((cell) => {
            const key = eskimoCellKey(cell);
            const piece = board[cell.row][cell.col];
            const moving = slide != null && eskimoCellKey(slide.move.action.to) === key;
            const selected = source != null && eskimoCellKey(source) === key;
            const target = targetKeys.has(key);
            const repeat = repeatKeys.has(key);
            const armed = target && placement.armed === key;
            const won = winKeys.has(key);
            const isLast =
              last != null && (eskimoCellKey(last.from) === key || eskimoCellKey(last.to) === key);
            const pickable = active && !source && canPick(cell);
            return (
              <BoardCellButton3D
                key={key}
                onClick={() => handleClick(cell)}
                disabled={!active || (!target && !canPick(cell))}
                aria-label={`${eskimoCellName(cell)} ${
                  repeat
                    ? '반복수라 둘 수 없음'
                    : piece === null
                      ? '빈칸'
                      : piece === ESKIMO_BEAR
                        ? '북극곰'
                        : `${gameData.players[piece]?.nickname ?? ''}의 말`
                }`}
                tone="plain"
                state={won ? 'highlight' : 'idle'}
                className={cn(!active && 'cursor-default', moving && boardStyles.movingCell)}
              >
                {piece && (
                  <span
                    className={cn(boardStyles.piecePosition, moving && boardStyles.sliding)}
                    data-eskimo-moving={moving ? 'true' : undefined}
                    style={
                      moving && offset
                        ? ({
                            '--slide-x': offset.x,
                            '--slide-y': offset.y,
                            '--slide-duration': `${slide.durationMs}ms`,
                          } as CSSProperties)
                        : undefined
                    }
                    onAnimationEnd={moving ? onSlideEnd : undefined}
                  >
                    <EskimoPiece
                      piece={piece}
                      firstPlayerId={firstPlayerId}
                      className={cn((pickable || (selected && active)) && boardStyles.activePiece)}
                    />
                    {piece === ESKIMO_BEAR && bearLocked && (
                      <span className="bg-cdm-fg text-cdm-bg absolute top-0.5 right-0.5 z-[2] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums">
                        {gameData.bearLockTurns}
                      </span>
                    )}
                  </span>
                )}
                {target && (
                  <span
                    data-eskimo-target
                    className={cn(
                      'bg-cdm-success pointer-events-none absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm',
                      armed ? 'ring-cdm-success/30 ring-4' : 'opacity-80',
                    )}
                  />
                )}
                {repeat && (
                  <span
                    data-eskimo-repeat
                    title="반복수라 둘 수 없습니다"
                    className="text-cdm-accent pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm leading-none font-black opacity-80"
                  >
                    ✕
                  </span>
                )}
                {isLast && !won && (
                  <span className="border-cdm-primary/60 pointer-events-none absolute inset-[6%] rounded-md border-2 border-dashed" />
                )}
              </BoardCellButton3D>
            );
          })}
        </Board3D>
      </div>

      {finished && !slide && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="border-cdm-primary bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
            <p className="text-cdm-primary text-base font-black">
              {winnerName ? `${winnerName} 승리!` : '게임 종료'}
            </p>
            {gameData.winType && (
              <p className="text-cdm-fg mt-1 text-xs font-bold">
                {ESKIMO_WIN_HINT[gameData.winType]}
              </p>
            )}
            <p className="text-cdm-fg-muted mt-1 text-xs">{gameData.finishReason}</p>
          </div>
        </div>
      )}
    </GameReferenceFrame>
  );
}

function orderedPlayers(gameData: EskimoGameData, myId: string) {
  return Object.entries(gameData.players).sort(([a], [b]) => {
    if (gameData.players[myId]) return Number(b === myId) - Number(a === myId);
    return Number(b === gameData.firstPlayerId) - Number(a === gameData.firstPlayerId);
  });
}

const EskimoSidePanel = memo(function EskimoSidePanel({ gameData }: { gameData: EskimoGameData }) {
  return (
    <GameInfoStack>
      <GameInfoPart title="기록" kind="history">
        <EskimoHistory gameData={gameData} />
      </GameInfoPart>
    </GameInfoStack>
  );
});

function EskimoHistory({ gameData }: { gameData: EskimoGameData }) {
  const log = gameData.history;
  if (log.length === 0) {
    return <p className="text-cdm-fg-muted text-xs">아직 둔 수가 없습니다.</p>;
  }
  return (
    <ol className="flex flex-col gap-1">
      {[...log].reverse().map((entry) => (
        <li
          key={entry.turn}
          className="bg-cdm-bg-elev-1 text-cdm-fg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
        >
          <span className="text-cdm-fg w-8 shrink-0 font-black tabular-nums">{entry.turn}T</span>
          <EskimoMarker tone={entry.actorId === gameData.firstPlayerId ? 'primary' : 'highlight'} />
          <span className="text-cdm-fg truncate font-semibold">
            {gameData.players[entry.actorId]?.nickname}
          </span>
          <span className="ml-auto shrink-0 tabular-nums">{eskimoMoveLabel(entry)}</span>
        </li>
      ))}
    </ol>
  );
}

export default memo(EskimoView);
