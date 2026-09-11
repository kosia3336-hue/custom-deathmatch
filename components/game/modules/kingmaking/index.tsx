'use client';

import { useEffect, useMemo, useState } from 'react';
import { getKingmakingLegalTargets, kingmakingPositionKey } from '@/shared/logic/kingmaking';
import type {
  KingmakingGameData,
  KingmakingPieceKind,
  KingmakingPosition,
} from '@/shared/types/kingmaking';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { getSocket } from '@/lib/socket';
import { getSkinTheme } from '@/lib/skins/registry';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { GAME_IDS } from '@/shared/types/game';
import {
  Board3D,
  BoardCellButton3D,
  GamePiece3D,
  PlayerStrip,
  usePlacementConfirm,
} from '@/components/game/abstract-strategy';
import { GameFrame } from '@/components/game/GameFrame';
import Modal from '@/components/ui/Modal';
import { StackVisual } from './StackVisual';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import SpringRainFieldFx from './skins/SpringRainFieldFx';

const MOVE_LABELS = ['한 칸 직선', '룩', '나이트', '비숍', '퀸'];

export default function KingmakingGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as KingmakingGameData | undefined;
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.KINGMAKING);
  useAbstractStrategyMoveSfx(gameData?.board, skin === 'spring-rain' ? 'spring-rain' : 'default');
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
  return (
    <KingmakingBoard
      key={`${gameData.turnNumber}:${myId}`}
      gameData={gameData}
      myId={myId}
      springRain={skin === 'spring-rain'}
    />
  );
}

function KingmakingBoard({
  gameData,
  myId,
  springRain,
}: {
  gameData: KingmakingGameData;
  myId: string;
  springRain: boolean;
}) {
  const { setHud } = useRoomLayout();
  const [mode, setMode] = useState<KingmakingPieceKind | 'move'>('normal');
  const [source, setSource] = useState<KingmakingPosition | null>(null);
  const [moveCount, setMoveCount] = useState(1);
  const [pending, setPending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  /*
    터치에서는 첫 탭에 반투명 말로 자리만 보여 주고, 같은 칸을 한 번 더 눌러야
    둔다·옮긴다. 말 종류·옮길 탑·층수를 바꾸면 보여 주던 모양이나 갈 수 있는
    곳이 달라지므로 비운다.
  */
  const placement = usePlacementConfirm(
    `${mode}:${source ? kingmakingPositionKey(source) : ''}:${moveCount}`,
  );

  const playerIds = Object.keys(gameData.players);
  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase === 'playing';
  const myReserve = gameData.reserves[myId] ?? { normal: 0, special: 0 };
  const canPlay = isMyTurn;
  const sidePanel = <KingmakingSidePanel gameData={gameData} myId={myId} springRain={springRain} />;

  useEffect(() => {
    setHud({
      round: `${gameData.turnNumber}턴`,
      order: gameData.phase === 'finished' ? '종료' : isMyTurn ? '내 차례' : '상대 차례',
      // 판 정보는 메모가 아니라 판 위(info)에 늘 펴 둔다 — design.md §14.9
    });
    return () => setHud(null);
  }, [gameData, isMyTurn, myId, setHud, springRain]);

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
      placement.tap(key, () => {
        setPending(true);
        getSocket().emit('game:action', { type: 'place', kind: mode, to: position });
      });
      return;
    }
    if (mode === 'move' && source && legalTargetKeys.has(key)) {
      const from = source;
      const count = moveCount;
      placement.tap(key, () => {
        setPending(true);
        getSocket().emit('game:action', {
          type: 'move',
          from,
          to: position,
          count,
        });
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
  const landing = gameData.lastAction?.action.to ?? null;
  /* 옮길 때 목적지에 반투명으로 얹어 보여 줄 말들 — 원래 탑의 위에서부터 moveCount 개 */
  const movingPieces = source ? gameData.board[source.row][source.col].slice(-moveCount) : [];

  return (
    <>
      <GameFrame
        className={springRain ? 'skin-spring-rain-field' : undefined}
        info={
          <PlayerStrip
            className={springRain ? 'skin-spring-rain-controls' : undefined}
            entries={playerIds.map((playerId, index) => {
              const reserve = gameData.reserves[playerId] ?? { normal: 0, special: 0 };
              return {
                id: playerId,
                name: gameData.players[playerId]?.nickname ?? '',
                isMe: playerId === myId,
                marker: (
                  <span className="block h-3.5 w-3.5">
                    <GamePiece3D tone={index === 0 ? 'primary' : 'highlight'} />
                  </span>
                ),
                detail: `일반 ${reserve.normal} · 특수 ${reserve.special}`,
                active: gameData.currentPlayerId === playerId && gameData.phase === 'playing',
              };
            })}
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
            springRain={springRain}
            armed={placement.armed != null}
          />
        }
        aside={sidePanel}
      >
        {springRain && <SpringRainFieldFx />}
        <Board3D
          fit
          columns={5}
          ariaLabel="5 곱하기 5 킹메이킹 보드"
          maxWidth="34rem"
          density="compact"
          className={springRain ? 'skin-spring-rain-board' : undefined}
          frameClassName={springRain ? 'skin-spring-rain-pond-frame' : undefined}
          gridClassName={springRain ? 'skin-spring-rain-pond-grid' : undefined}
        >
          {gameData.board.flatMap((row, rowIndex) =>
            row.map((stack, colIndex) => {
              const position = { row: rowIndex, col: colIndex };
              const key = kingmakingPositionKey(position);
              const selected = source && kingmakingPositionKey(source) === key;
              const legal = legalTargetKeys.has(key);
              const placeable = mode !== 'move' && stack.length === 0 && canPlay;
              const armed = placeable && placement.armed === key;
              const armedMove = legal && placement.armed === key;
              return (
                <BoardCellButton3D
                  key={key}
                  onClick={() => clickCell(position)}
                  disabled={!canPlay || pending || (!placeable && stack.length === 0 && !legal)}
                  aria-label={`${rowIndex + 1}행 ${colIndex + 1}열${stack.length ? `, ${stack.length}층` : ', 빈칸'}`}
                  tone={(rowIndex + colIndex) % 2 ? 'dark' : 'light'}
                  state={selected || armed || armedMove ? 'selected' : legal ? 'available' : 'idle'}
                  className={cn(
                    'kingmaking-board-cell',
                    springRain && 'kingmaking-spring-rain-cell',
                    !canPlay && 'cursor-default',
                  )}
                >
                  <StackVisual
                    stack={armedMove ? [...stack, ...movingPieces] : stack}
                    ghostFrom={armedMove ? stack.length : undefined}
                    playerIds={playerIds}
                    compact
                    springRain={springRain}
                  />
                  {springRain && landing?.row === rowIndex && landing.col === colIndex && (
                    <span
                      key={gameData.lastAction?.turn}
                      className="kingmaking-spring-rain-ripple"
                      aria-hidden
                    />
                  )}
                  {legal && (
                    <span className="bg-cdm-success absolute top-1 left-1 h-2.5 w-2.5 rounded-full shadow-sm" />
                  )}
                  {armed ? (
                    <span
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 opacity-55"
                      style={{ bottom: '8%', width: '66%', height: mode === 'special' ? '21%' : '17%' }}
                      aria-hidden
                    >
                      <GamePiece3D
                        tone={playerIds.indexOf(myId) === 0 ? 'primary' : 'highlight'}
                        shape={mode === 'special' ? 'crown' : 'disc'}
                        label={mode === 'special' ? '◆' : undefined}
                        className={springRain ? 'kingmaking-spring-rain-piece' : undefined}
                      />
                    </span>
                  ) : placeable && (
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
          /* 결과는 판·연출 위에 온다. z-index 를 빼면 스킨이 판을 띄우는 순간 밑에 깔린다. */
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className={cn(
              'border-cdm-primary bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur',
              springRain && 'skin-spring-rain-result',
            )}>
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

function KingmakingSidePanel({
  gameData,
  myId,
  springRain,
}: {
  gameData: KingmakingGameData;
  myId: string;
  springRain: boolean;
}) {
  return (
    <GameInfoStack className={springRain ? 'skin-spring-rain-side' : undefined}>
      <GameInfoPart title="남은 말">
        <div className="space-y-1.5">
          {Object.entries(gameData.players).map(([playerId, player]) => {
            const reserve = gameData.reserves[playerId] ?? { normal: 0, special: 0 };
            return (
              <div key={playerId} className={cn('rounded-md px-2.5 py-2', gameData.currentPlayerId === playerId && gameData.phase === 'playing' ? 'bg-cdm-primary/20' : 'bg-white/5')}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{player.nickname}{playerId === myId ? ' (나)' : ''}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">일반 {reserve.normal} · 특수 {reserve.special}</span>
                </div>
              </div>
            );
          })}
        </div>
      </GameInfoPart>
      <GameInfoPart><MoveReference springRain={springRain} /></GameInfoPart>
    </GameInfoStack>
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
  springRain,
  armed,
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
  springRain: boolean;
  /** 터치 첫 탭으로 둘 자리를 보여 주는 중 */
  armed: boolean;
}) {
  const counts = Array.from({ length: Math.min(5, sourceHeight) }, (_, i) => i + 1).reverse();

  return (
    <div className={cn(
      'border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2',
      springRain && 'skin-spring-rain-controls',
    )}>
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
              {armed ? '다시 누르면 이동' : `목적지 ${legalCount}곳`}
            </p>
          </div>
        ) : (
          <p className="text-cdm-fg-muted w-full text-center text-[11px]">
            {mode === 'move'
              ? '옮길 탑을 판에서 고르세요.'
              : armed
                ? '같은 칸을 한 번 더 누르면 놓습니다. 다른 칸을 누르면 자리만 옮깁니다.'
                : '빈칸을 눌러 말을 놓습니다. 탑을 누르면 이동으로 바뀝니다.'}
          </p>
        )}
      </div>
    </div>
  );
}

/** 참고 — 넓은 화면에서는 옆에, 좁은 화면에서는 ? 단추로 연다. */
function MoveReference({ springRain = false }: { springRain?: boolean }) {
  return (
    <div className={cn(
      'border-cdm-border bg-cdm-bg rounded-cdm-lg h-full border p-3',
      springRain && 'skin-spring-rain-reference',
    )}>
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
