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
import parlor from './eskimo-parlor.module.css';

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
      className={parlor.parlor}
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
        className="mx-auto flex w-full max-w-xl flex-col items-center p-2 sm:p-3"
      >
        <Board3D
          columns={ESKIMO_SIZE}
          ariaLabel="에스키모 판"
          maxWidth="34rem"
          density="compact"
          fit
          className={parlor.board}
          frameClassName={parlor.frame}
          gridClassName={parlor.grid}
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
                className={cn(parlor.cell, !active && 'cursor-default')}
              >
                {piece && (
                  <EskimoPiece
                    piece={piece}
                    firstPlayerId={firstPlayerId}
                    className={cn(pickable && 'drop-shadow-[0_0_6px_rgb(242_85_155_/_0.85)]')}
                  />
                )}
                {armed && sourcePiece && (
                  <EskimoPiece piece={sourcePiece} firstPlayerId={firstPlayerId} ghost />
                )}
                {target && !armed && (
                  <span className={parlor.sprinkles} aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                )}
                {isLast && !won && <span className={parlor.lastMove} aria-hidden />}
                {piece === ESKIMO_BEAR && bearLocked && !finished && (
                  <span className={parlor.lockBadge}>{gameData.bearLockTurns}</span>
                )}
              </BoardCellButton3D>
            );
          })}
        </Board3D>
      </div>

      {/* 결과는 판 아래쪽에 띄워 포위된 북극곰이 가려지지 않게 한다 */}
      {finished && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
          <div className={parlor.result}>
            <p className={parlor.resultTitle}>{winnerName ? `${winnerName} 승리!` : '게임 종료'}</p>
            {gameData.winType && (
              <p className={parlor.resultHint}>{ESKIMO_WIN_HINT[gameData.winType]}</p>
            )}
            <p className={parlor.resultReason}>{gameData.finishReason}</p>
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
              className={parlor.playerRow}
              data-active={!finished && gameData.currentPlayerId === playerId}
            >
              <span className="flex min-w-0 items-center gap-2">
                <EskimoMarker
                  tone={playerId === gameData.firstPlayerId ? 'primary' : 'highlight'}
                />
                <span className="truncate">
                  {player.nickname}
                  {playerId === myId ? ' (나)' : ''}
                </span>
              </span>
              <span className={parlor.seatChip}>
                {playerId === gameData.firstPlayerId ? '선' : '후'}
              </span>
            </div>
          ))}
          <div className={parlor.playerRow}>
            <span className="flex items-center gap-2">
              <EskimoMarker tone="bear" /> 북극곰
            </span>
            <span className={parlor.bearState} data-ready={!locked}>
              {locked ? `${locked}턴 뒤 이동 가능` : '이동 가능'}
            </span>
          </div>
          <p className={parlor.note}>
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
        <li key={entry.turn} className={parlor.historyRow}>
          <span className="w-8 shrink-0 font-black tabular-nums">{entry.turn}T</span>
          <EskimoMarker tone={entry.actorId === gameData.firstPlayerId ? 'primary' : 'highlight'} />
          <span className="truncate font-semibold">
            {gameData.players[entry.actorId]?.nickname}
          </span>
          <span className="ml-auto shrink-0 tabular-nums">{eskimoMoveLabel(entry)}</span>
        </li>
      ))}
    </ol>
  );
}

export default memo(EskimoView);
