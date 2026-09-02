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
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { Board3D, BoardCellButton3D } from '@/components/game/abstract-strategy';
import { GameFrame } from '@/components/game/GameFrame';
import Modal from '@/components/ui/Modal';
import { StackVisual } from './StackVisual';

const MOVE_LABELS = ['한 칸 직선', '룩', '나이트', '비숍', '퀸'];

export default function KingmakingGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as KingmakingGameData | undefined;
  useAbstractStrategyMoveSfx(gameData?.board);
  const myId = useMySocketId();

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  /*
    턴이 바뀔 때마다 갈아 끼워 고른 탑·행동을 비운다. 지난 턴의 선택이 남아
    있으면 이미 사라진 탑을 가리키게 된다.
  */
  return <KingmakingBoard key={`${gameData.turnNumber}:${myId}`} gameData={gameData} myId={myId} />;
}

function KingmakingBoard({ gameData, myId }: { gameData: KingmakingGameData; myId: string }) {
  const { remaining } = useTurnTimer();
  const [mode, setMode] = useState<KingmakingPieceKind | 'move'>('normal');
  const [source, setSource] = useState<KingmakingPosition | null>(null);
  const [moveCount, setMoveCount] = useState(1);
  const [pending, setPending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const playerIds = Object.keys(gameData.players);
  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase === 'playing';
  const myReserve = gameData.reserves[myId] ?? { normal: 0, special: 0 };
  const canPlay = isMyTurn;

  /*
    서버가 행동을 거부하면 턴이 그대로라 이 컴포넌트가 다시 마운트되지 않고,
    pending 이 켜진 채 남아 그 턴 내내 판을 누를 수 없게 된다. 거부 신호를
    직접 받아 풀어 준다. 토스트는 useRoom 의 전역 error 핸들러가 이미 띄운다.
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
      const left = mode === 'normal' ? myReserve.normal : myReserve.special;
      if (left <= 0) return;
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
      setMoveCount(Math.min(5, stack.length));
    }
  }

  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;
  const finished = gameData.phase === 'finished';

  return (
    <>
      <GameFrame
        info={
          <InfoBar
            gameData={gameData}
            myId={myId}
            remaining={remaining}
            isMyTurn={isMyTurn}
            isPlayer={isPlayer}
          />
        }
        controls={
          <ActionBar
            mode={mode}
            canPlay={canPlay}
            reserve={myReserve}
            source={source}
            sourceHeight={sourceHeight}
            moveCount={moveCount}
            legalCount={legalTargets.length}
            onChooseMode={chooseMode}
            onChooseCount={setMoveCount}
            onOpenHelp={() => setShowHelp(true)}
          />
        }
        aside={<MoveReference />}
      >
        <Board3D
          fit
          columns={5}
          ariaLabel="5 곱하기 5 킹메이킹 보드"
          maxWidth="34rem"
          density="compact"
        >
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
                  <StackVisual stack={stack} playerIds={playerIds} compact />
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

        {/*
          결과는 무대 위에 겹쳐 띄운다. 새 줄로 만들면 그 순간 판이 밀려 작아진다.
        */}
        {finished && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="border-cdm-primary bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
              <p className="text-cdm-primary text-base font-black">
                {winnerName ? `${winnerName} 승리!` : '게임 종료'}
              </p>
              <p className="text-cdm-fg-muted mt-1 text-xs">{gameData.finishReason}</p>
            </div>
          </div>
        )}
      </GameFrame>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="이동 규칙">
        <MoveReference />
      </Modal>
    </>
  );
}

/** 위 — 지금 상황만. 누를 것은 없다. */
function InfoBar({
  gameData,
  myId,
  remaining,
  isMyTurn,
  isPlayer,
}: {
  gameData: KingmakingGameData;
  myId: string;
  remaining: number | null;
  isMyTurn: boolean;
  isPlayer: boolean;
}) {
  const entries = Object.entries(gameData.players);
  const status = !isPlayer
    ? '관전 중'
    : gameData.phase === 'finished'
      ? '게임 종료'
      : isMyTurn
        ? '내 차례'
        : '상대 차례';

  return (
    <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 border p-1.5 sm:gap-2 sm:p-2">
      {entries.map(([playerId, player], index) => {
        const active = gameData.currentPlayerId === playerId && gameData.phase === 'playing';
        const reserve = gameData.reserves[playerId] ?? { normal: 0, special: 0 };
        return (
          <div
            key={playerId}
            className={cn(
              // 넓은 화면에서 이름표가 판 너비만큼 늘어나지 않도록 폭을 묶는다.
              'rounded-cdm-md min-w-0 border px-2 py-1 lg:w-60',
              index === 1 && 'order-3 justify-self-end text-right',
              active
                ? index === 0
                  ? 'border-cdm-primary bg-cdm-primary-soft'
                  : 'border-cdm-highlight bg-cdm-highlight-soft'
                : 'border-cdm-border bg-cdm-bg-elev-1',
            )}
          >
            <p className="text-cdm-fg truncate text-[11px] leading-4 font-bold">
              {player.nickname}
              {playerId === myId ? ' (나)' : ''}
            </p>
            <p className="text-cdm-fg-muted text-[10px] leading-4 tabular-nums">
              일반 {reserve.normal} · 특수 {reserve.special}
            </p>
          </div>
        );
      })}

      <div className="order-2 px-1 text-center">
        <p className="text-cdm-fg-subtle text-[10px] leading-3 font-bold tracking-[0.12em]">
          {status}
        </p>
        <p
          className={cn(
            'text-cdm-fg text-lg leading-6 font-black tabular-nums',
            remaining != null && remaining <= 10 && 'text-cdm-accent',
          )}
        >
          {remaining == null ? '∞' : Math.ceil(remaining)}
        </p>
      </div>
    </div>
  );
}

/**
 * 아래 — 누르는 것 전부.
 *
 * 보조 줄은 늘 같은 높이를 차지한다. 탑을 고를 때만 층수 단추가 나오게 하면
 * 그때마다 판 크기가 출렁여 눈이 피로하다.
 */
function ActionBar({
  mode,
  canPlay,
  reserve,
  source,
  sourceHeight,
  moveCount,
  legalCount,
  onChooseMode,
  onChooseCount,
  onOpenHelp,
}: {
  mode: KingmakingPieceKind | 'move';
  canPlay: boolean;
  reserve: { normal: number; special: number };
  source: KingmakingPosition | null;
  sourceHeight: number;
  moveCount: number;
  legalCount: number;
  onChooseMode: (next: KingmakingPieceKind | 'move') => void;
  onChooseCount: (count: number) => void;
  onOpenHelp: () => void;
}) {
  const counts = Array.from({ length: Math.min(5, sourceHeight) }, (_, i) => i + 1).reverse();

  return (
    <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
        <ModeButton
          active={mode === 'normal'}
          disabled={!canPlay || reserve.normal <= 0}
          onClick={() => onChooseMode('normal')}
          label={`일반말 ${reserve.normal}`}
        />
        <ModeButton
          active={mode === 'special'}
          disabled={!canPlay || reserve.special <= 0}
          onClick={() => onChooseMode('special')}
          label={`특수말 ${reserve.special}`}
        />
        <ModeButton
          active={mode === 'move'}
          disabled={!canPlay}
          onClick={() => onChooseMode('move')}
          label="탑 이동"
        />
        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="이동 규칙 보기"
          className="rounded-cdm-md border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted min-h-11 w-10 border text-sm font-black lg:hidden"
        >
          ?
        </button>
      </div>

      <div className="mt-1.5 flex min-h-11 items-center">
        {mode === 'move' && source ? (
          <div className="flex w-full items-center gap-1.5">
            <div className="flex flex-1 gap-1">
              {counts.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChooseCount(count)}
                  aria-label={
                    count === sourceHeight
                      ? `${count}층 전체 이동`
                      : `위에서 ${count}층 떼어 이동`
                  }
                  className={cn(
                    'rounded-cdm-sm border-cdm-border min-h-10 flex-1 border text-[11px] font-black',
                    moveCount === count
                      ? 'border-cdm-primary bg-cdm-primary text-white'
                      : 'bg-cdm-bg-elev-1 text-cdm-fg',
                  )}
                >
                  {count}
                  {count === sourceHeight && sourceHeight <= 5 ? '(전체)' : ''}
                </button>
              ))}
            </div>
            <p className="text-cdm-fg-muted w-24 shrink-0 text-right text-[10px] leading-3">
              {MOVE_LABELS[moveCount - 1]}
              <br />
              목적지 {legalCount}곳
            </p>
          </div>
        ) : (
          <p className="text-cdm-fg-muted w-full text-center text-[11px]">
            {mode === 'move'
              ? '옮길 탑을 판에서 고르세요.'
              : '빈칸을 눌러 말을 놓습니다. 탑을 누르면 이동으로 바뀝니다.'}
          </p>
        )}
      </div>
    </div>
  );
}

/** 참고 — 넓은 화면에서는 옆에, 좁은 화면에서는 ? 단추로 연다. */
function MoveReference() {
  return (
    <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg h-full border p-3">
      <p className="text-cdm-fg text-xs font-black">떼어 낸 층수별 이동</p>
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
      <p className="text-cdm-fg-muted mt-3 text-[11px] leading-4">
        ◆ 이동은 반드시 다른 탑 위로 합니다. 빈칸으로는 옮길 수 없습니다.
      </p>
      <p className="text-cdm-fg-muted mt-1 text-[11px] leading-4">
        ◆ 상대의 탑도 옮길 수 있습니다. 6층을 만든 탑의 <b>맨 위 말 주인</b>이 이깁니다.
      </p>
      <p className="text-cdm-fg-muted mt-1 text-[11px] leading-4">
        ◆ 특수말이 맨 위인 탑에는 올릴 수 없습니다.
      </p>
      <p className="text-cdm-fg-muted mt-1 text-[11px] leading-4">
        ◆ 경기 중 이미 나온 판 배치는 다시 만들 수 없습니다.
      </p>
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
        'rounded-cdm-md border-cdm-border min-h-11 border px-1 text-[11px] font-black transition-colors disabled:opacity-35',
        active
          ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
          : 'bg-cdm-bg-elev-1 text-cdm-fg',
      )}
    >
      {label}
    </button>
  );
}
