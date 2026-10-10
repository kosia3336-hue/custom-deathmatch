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
  PlayerStrip,
  usePlacementConfirm,
} from '@/components/game/abstract-strategy';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { cn } from '@/lib/utils';
import { eskimoCellKey, eskimoMoveTargets } from '@/shared/logic/eskimo';
import {
  ESKIMO_BEAR,
  ESKIMO_BEAR_LOCK_TURNS,
  ESKIMO_SIZE,
  type EskimoCell,
  type EskimoGameData,
} from '@/shared/types/eskimo';
import { EskimoMarker, EskimoPiece } from './EskimoPiece';
import { ESKIMO_WIN_HINT, eskimoCellName, eskimoMoveLabel } from './notation';

function EskimoView({ gameData, myId }: GameModuleViewProps<EskimoGameData>) {
  useAbstractStrategyMoveSfx(gameData?.board);

  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase !== 'finished';

  /* 턴이 바뀌면 갈아 끼워 고른 말·보여 주던 자리를 비운다. */
  return (
    <PlaySurface
      key={`${gameData.turnNumber}:${gameData.phase}:${myId}`}
      gameData={gameData}
      myId={myId}
      isPlayer={isPlayer}
      isMyTurn={isMyTurn}
    />
  );
}

function PlaySurface({
  gameData,
  myId,
  isPlayer,
  isMyTurn,
}: {
  gameData: EskimoGameData;
  myId: string;
  isPlayer: boolean;
  isMyTurn: boolean;
}) {
  const sendAction = useGameAction();
  const { subscribeError } = useGameFeedback();
  const { setHud, setHeaderBelow } = useRoomLayout();
  const [source, setSource] = useState<EskimoCell | null>(null);
  const [pending, setPending] = useState(false);
  const placement = usePlacementConfirm(source ? eskimoCellKey(source) : '');

  const { board, firstPlayerId } = gameData;
  const finished = gameData.phase === 'finished';
  const bearLocked = gameData.bearLockTurns > 0;
  const active = isMyTurn && !pending;
  /* 후 플레이어는 판을 돌려 내 말이 아래에 오게 본다. 관전자는 선 쪽에서 본다. */
  const flip = isPlayer && myId !== firstPlayerId;

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
    return () => setHud(null);
  }, [
    finished,
    gameData.currentPlayerId,
    gameData.players,
    gameData.turnNumber,
    isMyTurn,
    isPlayer,
    setHud,
  ]);

  /* 서버가 거부하면 턴이 그대로라 다시 마운트되지 않는다 — 거부 신호로 잠금을 푼다. */
  useEffect(() => subscribeError(() => setPending(false)), [subscribeError]);

  const targets = useMemo(
    () => (source ? eskimoMoveTargets(board, source, myId, bearLocked) : []),
    [board, bearLocked, myId, source],
  );
  const targetKeys = useMemo(() => new Set(targets.map(eskimoCellKey)), [targets]);
  const winKeys = useMemo(() => new Set(gameData.winCells.map(eskimoCellKey)), [gameData.winCells]);
  const last = gameData.lastAction?.action ?? null;

  function canPick(cell: EskimoCell) {
    const piece = board[cell.row][cell.col];
    if (piece !== myId && piece !== ESKIMO_BEAR) return false;
    return eskimoMoveTargets(board, cell, myId, bearLocked).length > 0;
  }

  function handleClick(cell: EskimoCell) {
    if (!active) return;
    const key = eskimoCellKey(cell);
    if (source && targetKeys.has(key)) {
      const from = source;
      placement.tap(key, () => {
        setPending(true);
        sendAction({ type: 'move', from, to: cell });
      });
      return;
    }
    if (canPick(cell)) {
      placement.clear();
      setSource(source && eskimoCellKey(source) === key ? null : cell);
    }
  }

  const sourcePiece = source ? board[source.row][source.col] : null;
  const currentName = gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어';
  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;

  const guide = finished
    ? [winnerName ? `${winnerName} 승리!` : '게임 종료', gameData.finishReason]
        .filter(Boolean)
        .join(' · ')
    : !isPlayer
      ? `관전 중 · ${currentName} 님의 차례입니다.`
      : !isMyTurn
        ? `${currentName} 님의 차례입니다.`
        : placement.armed
          ? '같은 칸을 한 번 더 누르면 옮깁니다.'
          : source
            ? sourcePiece === ESKIMO_BEAR
              ? '북극곰은 붙은 빈칸으로 한 칸 옮깁니다. 초록 칸을 누르세요.'
              : '고른 방향으로 막힐 때까지 미끄러집니다. 초록 칸을 누르세요.'
            : bearLocked
              ? `내 말을 골라 옮기세요. 북극곰은 ${gameData.bearLockTurns}턴 뒤에 옮길 수 있습니다.`
              : '내 말이나 북극곰을 골라 옮기세요. 북극곰의 사방을 막으면 이깁니다.';

  useEffect(() => {
    setHeaderBelow(
      <p className="text-cdm-ink-fg-muted text-[11px] leading-relaxed sm:text-xs">{guide}</p>,
    );
    return () => setHeaderBelow(null);
  }, [guide, setHeaderBelow]);

  const players = orderedPlayers(gameData, myId);
  const bearStatus = (
    <span className="inline-flex items-center gap-1">
      <EskimoMarker tone="bear" />
      {bearLocked ? `${gameData.bearLockTurns}턴 잠김` : '이동 가능'}
    </span>
  );

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
      reference={<EskimoSidePanel gameData={gameData} myId={myId} />}
      info={
        <PlayerStrip
          entries={players.map(([playerId, player]) => ({
            id: playerId,
            name: player.nickname,
            isMe: playerId === myId,
            marker: <EskimoMarker tone={playerId === firstPlayerId ? 'primary' : 'highlight'} />,
            detail: playerId === firstPlayerId ? '선' : '후',
            active: !finished && gameData.currentPlayerId === playerId,
          }))}
          extra={bearStatus}
        />
      }
    >
      <div
        data-game-intrinsic-stage
        className="border-cdm-border bg-cdm-bg rounded-cdm-lg mx-auto flex w-full max-w-xl flex-col items-center border p-2 sm:p-3"
      >
        <Board3D
          columns={ESKIMO_SIZE}
          ariaLabel="에스키모 판"
          maxWidth="34rem"
          density="compact"
          fit
        >
          {cells.map((cell) => {
            const key = eskimoCellKey(cell);
            const piece = board[cell.row][cell.col];
            const selected = source != null && eskimoCellKey(source) === key;
            const target = targetKeys.has(key);
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
                  piece === null
                    ? '빈칸'
                    : piece === ESKIMO_BEAR
                      ? '북극곰'
                      : `${gameData.players[piece]?.nickname ?? ''}의 말`
                }`}
                tone={(cell.row + cell.col) % 2 ? 'dark' : 'light'}
                state={
                  won ? 'highlight' : selected || armed ? 'selected' : target ? 'available' : 'idle'
                }
                className={cn(!active && 'cursor-default')}
              >
                {piece && (
                  <EskimoPiece
                    piece={piece}
                    firstPlayerId={firstPlayerId}
                    className={cn(pickable && 'drop-shadow-[0_0_6px_var(--cdm-primary)]')}
                  />
                )}
                {armed && sourcePiece && (
                  <EskimoPiece piece={sourcePiece} firstPlayerId={firstPlayerId} ghost />
                )}
                {target && !armed && (
                  <span className="bg-cdm-success absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 shadow-sm" />
                )}
                {isLast && !won && (
                  <span className="border-cdm-primary/60 pointer-events-none absolute inset-[6%] rounded-md border-2 border-dashed" />
                )}
                {piece === ESKIMO_BEAR && bearLocked && (
                  <span className="bg-cdm-fg text-cdm-bg absolute top-0.5 right-0.5 z-[2] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums">
                    {gameData.bearLockTurns}
                  </span>
                )}
              </BoardCellButton3D>
            );
          })}
        </Board3D>
      </div>

      {finished && (
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

function EskimoSidePanel({ gameData, myId }: { gameData: EskimoGameData; myId: string }) {
  const finished = gameData.phase === 'finished';
  const locked = gameData.bearLockTurns;
  return (
    <GameInfoStack>
      <GameInfoPart title="플레이어" kind="auto" sizeToContent>
        <div className="flex flex-col gap-1.5">
          {orderedPlayers(gameData, myId).map(([playerId, player]) => (
            <div
              key={playerId}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm',
                !finished && gameData.currentPlayerId === playerId
                  ? 'bg-cdm-primary-soft text-cdm-primary'
                  : 'text-cdm-fg bg-cdm-bg-elev-1',
              )}
            >
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <EskimoMarker
                  tone={playerId === gameData.firstPlayerId ? 'primary' : 'highlight'}
                />
                <span className="truncate">
                  {player.nickname}
                  {playerId === myId ? ' (나)' : ''}
                </span>
              </span>
              <span className="text-xs font-black">
                {playerId === gameData.firstPlayerId ? '선' : '후'}
              </span>
            </div>
          ))}
          <div className="text-cdm-fg bg-cdm-bg-elev-1 flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <EskimoMarker tone="bear" /> 북극곰
            </span>
            <span
              className={cn(
                'text-xs font-black tabular-nums',
                locked ? 'text-cdm-fg-muted' : 'text-cdm-success',
              )}
            >
              {locked ? `${locked}턴 뒤 이동 가능` : '이동 가능'}
            </span>
          </div>
          <p className="text-cdm-fg-subtle px-1 text-[11px] leading-relaxed">
            북극곰을 옮기면 다음 {ESKIMO_BEAR_LOCK_TURNS}턴(양쪽 차례 합산) 동안 아무도 옮길 수
            없습니다.
          </p>
        </div>
      </GameInfoPart>
      <GameInfoPart title="기록" kind="history">
        <EskimoHistory gameData={gameData} />
      </GameInfoPart>
    </GameInfoStack>
  );
}

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
