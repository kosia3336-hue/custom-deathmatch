'use client';

import { useEffect, useMemo, useState } from 'react';
import { getKingmakingLegalTargets, kingmakingPositionKey } from '@/shared/logic/kingmaking';
import type {
  KingmakingGameData,
  KingmakingPieceKind,
  KingmakingPosition,
} from '@/shared/types/kingmaking';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { Board3D, BoardCellButton3D } from '@/components/game/abstract-strategy';
import { StackVisual } from './StackVisual';

const MOVE_LABELS = ['한 칸 직선', '룩', '나이트', '비숍', '퀸'];

export default function KingmakingGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as KingmakingGameData | undefined;
  const myId = useMySocketId();
  const { remaining } = useTurnTimer();

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase === 'playing';
  const currentName = gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어';
  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-4">
      <header className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto] items-center gap-2 border p-2.5 sm:grid-cols-[1fr_auto_1fr] sm:p-3">
        <div className="min-w-0">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.18em]">
            TURN {gameData.turnNumber}
          </p>
          <p className="text-cdm-fg truncate text-sm font-black">
            {gameData.phase === 'finished'
              ? '게임 종료'
              : isMyTurn
                ? '내 차례입니다'
                : `${currentName} 님의 차례`}
          </p>
          <p className="text-cdm-fg-muted hidden text-xs sm:block">
            새 말을 놓거나, 탑의 위쪽 일부를 떼어 다른 탑 위로 이동하세요.
          </p>
        </div>
        <div className="bg-cdm-bg-elev-1 rounded-cdm-md min-w-20 px-3 py-1.5 text-center">
          <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-[0.14em]">TIME</p>
          <p
            className={cn(
              'text-cdm-fg text-xl font-black tabular-nums',
              remaining != null && remaining <= 10 && 'text-cdm-accent',
            )}
          >
            {remaining == null ? '∞' : Math.ceil(remaining)}
          </p>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:justify-end">
          {playerEntries.map(([playerId, player], index) => (
            <div
              key={playerId}
              className={cn(
                'rounded-cdm-md min-w-0 border px-2.5 py-1.5 sm:min-w-28',
                gameData.currentPlayerId === playerId && gameData.phase === 'playing'
                  ? index === 0
                    ? 'border-cdm-primary bg-cdm-primary-soft'
                    : 'border-cdm-highlight bg-cdm-highlight-soft'
                  : 'border-cdm-border bg-cdm-bg-elev-1',
              )}
            >
              <p className="text-cdm-fg truncate text-[11px] font-bold">
                {player.nickname}
                {playerId === myId ? ' (나)' : ''}
              </p>
              <div className="text-cdm-fg-muted mt-0.5 flex items-center justify-between text-[10px]">
                <span>일반 {gameData.reserves[playerId]?.normal ?? 0}</span>
                <span>특수 {gameData.reserves[playerId]?.special ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <KingmakingWorkspace
        key={`${gameData.turnNumber}:${myId}`}
        gameData={gameData}
        myId={myId}
        canPlay={isMyTurn}
      />

      {!isPlayer && gameData.phase === 'playing' && (
        <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
      )}
      {gameData.phase === 'finished' && (
        <div className="bg-cdm-primary-soft rounded-cdm-lg p-4 text-center">
          <p className="text-cdm-primary text-base font-black">
            {winnerName ? `${winnerName} 승리!` : '게임 종료'}
          </p>
          <p className="text-cdm-fg-muted mt-1 text-xs">{gameData.finishReason}</p>
        </div>
      )}
    </div>
  );
}

function KingmakingWorkspace({
  gameData,
  myId,
  canPlay,
}: {
  gameData: KingmakingGameData;
  myId: string;
  canPlay: boolean;
}) {
  const [mode, setMode] = useState<KingmakingPieceKind | 'move'>('normal');
  const [source, setSource] = useState<KingmakingPosition | null>(null);
  const [moveCount, setMoveCount] = useState(1);
  const [pending, setPending] = useState(false);
  const playerIds = Object.keys(gameData.players);
  const myReserve = gameData.reserves[myId] ?? { normal: 0, special: 0 };

  /*
    이 컴포넌트는 턴 번호가 바뀔 때만 리마운트된다. 서버가 행동을 거부하면
    턴이 그대로라 리마운트가 없고, pending 이 켜진 채 남아 그 턴 내내 보드를
    누를 수 없게 된다. 거부 신호(error)를 직접 받아 풀어 준다.
    토스트는 useRoom 의 전역 error 핸들러가 이미 띄운다.
  */
  useEffect(() => {
    const socket = getSocket();
    const releasePending = () => setPending(false);
    socket.on('error', releasePending);
    return () => {
      socket.off('error', releasePending);
    };
  }, []);

  const legalTargets = useMemo(
    () => (source ? getKingmakingLegalTargets(gameData.board, source, moveCount) : []),
    [gameData.board, moveCount, source],
  );
  const legalTargetKeys = useMemo(
    () => new Set(legalTargets.map(kingmakingPositionKey)),
    [legalTargets],
  );
  const sourceHeight = source ? gameData.board[source.row][source.col].length : 0;

  function chooseMode(next: KingmakingPieceKind | 'move') {
    if (!canPlay) return;
    setMode(next);
    setSource(null);
    setMoveCount(1);
  }

  function clickCell(position: KingmakingPosition) {
    if (!canPlay || pending) return;
    const stack = gameData.board[position.row][position.col];
    const key = kingmakingPositionKey(position);
    if (mode !== 'move' && stack.length === 0) {
      const remaining = mode === 'normal' ? myReserve.normal : myReserve.special;
      if (remaining <= 0) return;
      setPending(true);
      getSocket().emit('game:action', { type: 'place', kind: mode, to: position });
      return;
    }
    if (mode === 'move' && source && legalTargetKeys.has(key)) {
      setPending(true);
      getSocket().emit('game:action', {
        type: 'move',
        from: source,
        to: position,
        count: moveCount,
      });
      return;
    }
    if (stack.length > 0) {
      setMode('move');
      setSource(position);
      setMoveCount(1);
    }
  }

  return (
    <div className="grid min-h-0 flex-1 items-start gap-3 lg:grid-cols-[minmax(0,34rem)_minmax(16rem,19rem)] lg:justify-center">
      <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2.5 sm:p-3">
        <Board3D columns={5} ariaLabel="5 곱하기 5 킹메이킹 보드" maxWidth="min(34rem, 62dvh)">
          {gameData.board.flatMap((row, rowIndex) =>
            row.map((stack, colIndex) => {
              const position = { row: rowIndex, col: colIndex };
              const key = kingmakingPositionKey(position);
              const selected = source && kingmakingPositionKey(source) === key;
              const legal = legalTargetKeys.has(key);
              const placeable = mode !== 'move' && stack.length === 0 && canPlay;
              return (
                <BoardCellButton3D
                  key={key}
                  onClick={() => clickCell(position)}
                  disabled={!canPlay || pending || (!placeable && stack.length === 0 && !legal)}
                  aria-label={`${rowIndex + 1}행 ${colIndex + 1}열${stack.length ? `, ${stack.length}층` : ', 빈칸'}`}
                  tone={(rowIndex + colIndex) % 2 ? 'dark' : 'light'}
                  state={selected ? 'selected' : legal ? 'available' : 'idle'}
                  className={cn(!canPlay && 'cursor-default')}
                >
                  <StackVisual stack={stack} playerIds={playerIds} />
                  {legal && (
                    <span className="bg-cdm-success absolute top-1 left-1 h-2.5 w-2.5 rounded-full shadow-sm" />
                  )}
                  {placeable && (
                    <span className="text-cdm-fg-subtle absolute inset-0 flex items-center justify-center text-xl font-light opacity-35">
                      ＋
                    </span>
                  )}
                </BoardCellButton3D>
              );
            }),
          )}
        </Board3D>
      </section>

      <aside className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
        <p className="text-cdm-fg text-sm font-black">행동 선택</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <ModeButton
            active={mode === 'normal'}
            disabled={!canPlay || myReserve.normal <= 0}
            onClick={() => chooseMode('normal')}
            label={`일반말 · ${myReserve.normal}`}
          />
          <ModeButton
            active={mode === 'special'}
            disabled={!canPlay || myReserve.special <= 0}
            onClick={() => chooseMode('special')}
            label={`특수말 · ${myReserve.special}`}
          />
          <ModeButton
            active={mode === 'move'}
            disabled={!canPlay}
            onClick={() => chooseMode('move')}
            label="탑 이동"
          />
        </div>

        {mode === 'move' && (
          <div className="border-cdm-border mt-3 border-t pt-3">
            <p className="text-cdm-fg text-xs font-black">
              {source
                ? `${sourceHeight}층 탑 선택됨 · 위에서 몇 층을 떼나요?`
                : '이동할 탑을 선택하세요.'}
            </p>
            {source && (
              <div className="mt-2 grid grid-cols-5 gap-1">
                {Array.from({ length: Math.min(5, sourceHeight) }, (_, index) => index + 1).map(
                  (count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMoveCount(count)}
                      className={cn(
                        'rounded-cdm-sm border-cdm-border min-h-10 border text-xs font-black',
                        moveCount === count
                          ? 'border-cdm-primary bg-cdm-primary text-white'
                          : 'bg-cdm-bg-elev-1 text-cdm-fg',
                      )}
                    >
                      {count}
                    </button>
                  ),
                )}
              </div>
            )}
            {source && (
              <p className="text-cdm-fg-muted mt-2 text-[11px]">
                {moveCount}층 · {MOVE_LABELS[moveCount - 1]} 이동 · 가능한 목적지{' '}
                {legalTargets.length}곳
              </p>
            )}
          </div>
        )}

        <div className="border-cdm-border mt-4 border-t pt-3">
          <p className="text-cdm-fg text-xs font-black">층수별 이동</p>
          <div className="text-cdm-fg-muted mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {MOVE_LABELS.map((label, index) => (
              <span key={label}>
                <b className="text-cdm-fg">{index + 1}층</b> {label}
              </span>
            ))}
            <span>
              <b className="text-cdm-accent">6층</b> 즉시 승리
            </span>
          </div>
          <p className="text-cdm-fg-muted mt-2 text-[11px] leading-4">
            ◆ 특수말이 맨 위인 탑에는 다른 말을 올릴 수 없습니다.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-cdm-md border-cdm-border min-h-11 border px-2 text-[11px] font-black transition-colors disabled:opacity-35',
        active
          ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
          : 'bg-cdm-bg-elev-1 text-cdm-fg',
      )}
    >
      {label}
    </button>
  );
}
