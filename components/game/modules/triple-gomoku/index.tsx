'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { cn } from '@/lib/utils';
import {
  canMoveTripleGomokuStone,
  canPlaceTripleGomokuSetup,
  canPlaceTripleGomokuStone,
  isSameTripleGomokuCell,
  tripleGomokuCellKey,
  tripleGomokuMoveTargets,
  tripleGomokuTopOwner,
} from '@/shared/logic/triple-gomoku';
import {
  TG_MAX_HEIGHT,
  type TripleGomokuCell,
  type TripleGomokuGameData,
} from '@/shared/types/triple-gomoku';
import { useRoomStore } from '@/stores/room';
import { TripleGomokuBoardView, type TripleGomokuCellMark } from './BoardView';

type ActionMode = 'place' | 'move';

const WIN_HINT: Record<string, string> = {
  line: '오목 완성',
  'top-count': '3층 돌 다섯 개',
  'top-cluster': '붙어 있는 3층 돌 세 개',
  timeout: '제한시간 초과',
  'no-action': '둘 수 없음',
  forfeit: '기권',
};

export default function TripleGomokuGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as TripleGomokuGameData | undefined;
  const myId = useMySocketId();
  const { remaining } = useTurnTimer();
  const [tilted, setTilted] = useState(true);

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  const entries = Object.entries(gameData.players);
  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase !== 'finished';
  const currentName = gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어';
  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-4">
      <header className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto] items-center gap-2 border p-2.5 sm:grid-cols-[1fr_auto_1fr] sm:p-3">
        <div className="min-w-0">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.18em]">
            {gameData.phase === 'setup' ? '기본 배치' : `TURN ${gameData.turnNumber}`}
          </p>
          <p className="text-cdm-fg truncate text-sm font-black">
            {gameData.phase === 'finished'
              ? '게임 종료'
              : isMyTurn
                ? gameData.phase === 'setup'
                  ? `내 차례 · ${gameData.setupRemaining}개 놓기`
                  : '내 차례입니다'
                : `${currentName} 님의 차례`}
          </p>
          <p className="text-cdm-fg-muted hidden truncate text-xs sm:block">
            {gameData.phase === 'setup'
              ? '정중앙과 자기 돌 옆에는 놓을 수 없습니다.'
              : '돌을 놓거나, 내 돌을 옆 칸으로 옮겨 쌓으세요.'}
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
          {entries.map(([playerId, player]) => (
            <div
              key={playerId}
              className={cn(
                'rounded-cdm-md min-w-0 border px-2.5 py-1.5 sm:min-w-28',
                gameData.currentPlayerId === playerId && gameData.phase !== 'finished'
                  ? 'border-cdm-primary bg-cdm-primary-soft'
                  : 'border-cdm-border bg-cdm-bg-elev-1',
              )}
            >
              <p className="text-cdm-fg truncate text-[11px] font-bold">
                {player.nickname}
                {playerId === myId ? ' (나)' : ''}
              </p>
              <p className="text-cdm-fg-muted text-[10px]">
                남은 돌{' '}
                <span className="text-cdm-fg font-black tabular-nums">
                  {gameData.reserves[playerId] ?? 0}
                </span>
              </p>
            </div>
          ))}
        </div>
      </header>

      <PlaySurface
        key={`${gameData.turnNumber}:${gameData.phase}:${myId}`}
        gameData={gameData}
        myId={myId}
        canPlay={isMyTurn}
        tilted={tilted}
        onToggleTilt={() => setTilted((value) => !value)}
      />

      {!isPlayer && gameData.phase !== 'finished' && (
        <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
      )}
      {gameData.phase === 'finished' && (
        <div className="bg-cdm-primary-soft rounded-cdm-lg p-4 text-center">
          <p className="text-cdm-primary text-base font-black">
            {winnerName ? `${winnerName} 승리!` : '게임 종료'}
            {gameData.winType && (
              <span className="text-cdm-fg-muted ml-2 text-xs font-bold">
                {WIN_HINT[gameData.winType] ?? ''}
              </span>
            )}
          </p>
          <p className="text-cdm-fg-muted mt-1 text-xs">{gameData.finishReason}</p>
        </div>
      )}
    </div>
  );
}

function PlaySurface({
  gameData,
  myId,
  canPlay,
  tilted,
  onToggleTilt,
}: {
  gameData: TripleGomokuGameData;
  myId: string;
  canPlay: boolean;
  tilted: boolean;
  onToggleTilt: () => void;
}) {
  const [mode, setMode] = useState<ActionMode>('place');
  const [source, setSource] = useState<TripleGomokuCell | null>(null);
  const [pending, setPending] = useState(false);
  const setup = gameData.phase === 'setup';
  const reserve = gameData.reserves[myId] ?? 0;
  const active = canPlay && !pending;

  /*
    이 컴포넌트는 턴이 바뀔 때만 리마운트된다. 서버가 행동을 거부하면 턴이
    그대로라 pending 이 걸린 채 남으므로 error 신호를 직접 받아 풀어 준다.
  */
  useEffect(() => {
    const socket = getSocket();
    const release = () => setPending(false);
    socket.on('error', release);
    return () => {
      socket.off('error', release);
    };
  }, []);

  const targets = useMemo(
    () => (source ? tripleGomokuMoveTargets(gameData.board, source, myId) : []),
    [gameData.board, myId, source],
  );
  const targetKeys = useMemo(() => new Set(targets.map(tripleGomokuCellKey)), [targets]);
  const winKeys = useMemo(
    () => new Set(gameData.winCells.map(tripleGomokuCellKey)),
    [gameData.winCells],
  );
  const lastKeys = useMemo(() => {
    const action = gameData.lastAction?.action;
    if (!action) return new Set<string>();
    return new Set(
      action.type === 'place'
        ? [tripleGomokuCellKey(action.to)]
        : [tripleGomokuCellKey(action.from), tripleGomokuCellKey(action.to)],
    );
  }, [gameData.lastAction]);

  function canPlaceHere(cell: TripleGomokuCell) {
    if (reserve <= 0) return false;
    return setup
      ? canPlaceTripleGomokuSetup(gameData.board, cell, myId)
      : canPlaceTripleGomokuStone(gameData.board, cell);
  }

  function isEnabled(cell: TripleGomokuCell) {
    if (!active) return false;
    if (setup || mode === 'place') return canPlaceHere(cell);
    if (source && targetKeys.has(tripleGomokuCellKey(cell))) return true;
    return tripleGomokuTopOwner(gameData.board, cell) === myId;
  }

  function markOf(cell: TripleGomokuCell): TripleGomokuCellMark {
    const key = tripleGomokuCellKey(cell);
    if (winKeys.has(key)) return 'win';
    if (source && isSameTripleGomokuCell(source, cell)) return 'selected';
    if (targetKeys.has(key)) return 'target';
    if (lastKeys.has(key)) return 'last';
    return 'none';
  }

  function handleClick(cell: TripleGomokuCell) {
    if (!active) return;
    if (setup || mode === 'place') {
      if (!canPlaceHere(cell)) return;
      setPending(true);
      getSocket().emit('game:action', { type: 'place', to: cell });
      return;
    }
    if (source && canMoveTripleGomokuStone(gameData.board, source, cell, myId)) {
      setPending(true);
      getSocket().emit('game:action', { type: 'move', from: source, to: cell });
      return;
    }
    if (tripleGomokuTopOwner(gameData.board, cell) === myId) setSource(cell);
  }

  const sourceHeight = source ? (gameData.board[tripleGomokuCellKey(source)]?.length ?? 0) : 0;

  return (
    <div className="grid min-h-0 flex-1 items-start gap-3 lg:grid-cols-[minmax(0,38rem)_minmax(15rem,18rem)] lg:justify-center">
      <TripleGomokuBoardView
        board={gameData.board}
        firstPlayerId={gameData.firstPlayerId}
        tilted={tilted}
        markOf={markOf}
        onCellClick={handleClick}
        isEnabled={isEnabled}
        ariaLabel="삼층 오목 판"
        className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 sm:p-3"
      />

      <aside className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-cdm-fg text-sm font-black">행동</p>
          <button
            type="button"
            onClick={onToggleTilt}
            className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md min-h-8 border px-2.5 text-[11px] font-black"
            aria-pressed={tilted}
          >
            {tilted ? '평면으로 보기' : '입체로 보기'}
          </button>
        </div>

        {setup ? (
          <p className="text-cdm-fg-muted mt-3 text-xs leading-5">
            기본 배치 중입니다. 이번 턴에{' '}
            <span className="text-cdm-fg font-black">{gameData.setupRemaining}개</span>를 놓습니다.
            정중앙과 이미 놓은 자기 돌 옆은 고를 수 없습니다.
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <ModeButton
                active={mode === 'place'}
                disabled={!active || reserve <= 0}
                onClick={() => {
                  setMode('place');
                  setSource(null);
                }}
                label={`돌 놓기 · ${reserve}`}
              />
              <ModeButton
                active={mode === 'move'}
                disabled={!active}
                onClick={() => setMode('move')}
                label="돌 옮기기"
              />
            </div>
            <p className="text-cdm-fg-muted mt-2 text-[11px] leading-4">
              {mode === 'place'
                ? '빈칸 아무 곳에나 새 돌을 놓습니다.'
                : source
                  ? `${sourceHeight}층 칸 선택됨 · 갈 수 있는 곳 ${targets.length}곳`
                  : '옮길 내 돌을 고르세요. 맨 위 돌만 움직입니다.'}
            </p>
            {mode === 'move' && source && (
              <button
                type="button"
                onClick={() => setSource(null)}
                className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md mt-2 min-h-9 w-full border text-xs font-black"
              >
                선택 해제
              </button>
            )}
          </>
        )}

        <div className="border-cdm-border text-cdm-fg-muted mt-4 border-t pt-3 text-[11px] leading-5">
          <p className="text-cdm-fg font-black">승리 조건</p>
          <p>· 위에서 봐서 내 돌 5개가 일직선 (6개는 인정 안 됨)</p>
          <p>· 3층에 올라간 내 돌 5개</p>
          <p>· 서로 붙어 있는 3층 돌 3개</p>
          <p className="mt-2">
            돌은 {TG_MAX_HEIGHT}층까지 쌓이고, 원래 칸보다 높은 칸으로는 갈 수 없습니다.
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
