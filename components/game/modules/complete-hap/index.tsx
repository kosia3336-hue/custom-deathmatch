'use client';

import { useState, useEffect } from 'react';
import { AI_PLAYER_ID } from '@/shared/types/room';
import type {
  CompleteHapBoard,
  CompleteHapCard,
  CompleteHapGameData,
} from '@/shared/types/complete-hap';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const BACKGROUND_COLORS = {
  black: '#111318',
  gray: '#7a808a',
  white: '#f7f7f3',
} as const;

const SHAPE_COLORS = {
  red: '#ef4444',
  yellow: '#facc15',
  blue: '#2563eb',
} as const;

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function CompleteHapGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as CompleteHapGameData | undefined;
  const myId = useMySocketId();
  const [now, setNow] = useState(gameData?.matchStartedAt ?? 0);
  const [selection, setSelection] = useState<{ boardIndex: number | null; indexes: number[] }>({
    boardIndex: null,
    indexes: [],
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, []);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cdm-fg-muted">게임을 불러오는 중...</p>
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const matchRemaining =
    gameData.matchSeconds == null
      ? null
      : Math.max(
          0,
          Math.ceil((gameData.matchStartedAt + gameData.matchSeconds * 1000 - now) / 1000),
        );
  const playerEntries = Object.entries(gameData.players);
  const lastClaimPlayer = gameData.lastProblemClaim
    ? (gameData.players[gameData.lastProblemClaim.playerId]?.nickname ??
      (gameData.lastProblemClaim.playerId === AI_PLAYER_ID ? 'COM' : '플레이어'))
    : null;

  function toggleCard(boardIndex: number, cardIndex: number) {
    if (!isPlayer || gameData!.phase !== 'playing') return;
    setSelection((current) => {
      const indexes = current.boardIndex === boardIndex ? current.indexes : [];
      if (indexes.includes(cardIndex)) {
        return { boardIndex, indexes: indexes.filter((index) => index !== cardIndex) };
      }
      if (indexes.length >= 3) return { boardIndex, indexes };
      return { boardIndex, indexes: [...indexes, cardIndex] };
    });
  }

  function submitHap(boardIndex: number) {
    if (
      !isPlayer ||
      gameData!.phase !== 'playing' ||
      selection.boardIndex !== boardIndex ||
      selection.indexes.length !== 3
    ) {
      return;
    }
    getSocket().emit('game:action', {
      type: 'submit-hap',
      boardIndex,
      cardIndexes: selection.indexes,
    });
    setSelection({ boardIndex: null, indexes: [] });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="rounded-cdm-lg border-cdm-border bg-cdm-bg grid gap-3 border p-3 shadow-sm md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="min-w-0">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.18em]">
            REAL-TIME RACE
          </p>
          <p className="text-cdm-fg truncate text-sm font-extrabold">
            {gameData.phase === 'finished' ? '게임 종료' : '세 문제 동시 선착순'}
          </p>
          <p className="text-cdm-fg-muted truncate text-xs">
            {gameData.lastProblemClaim
              ? `${lastClaimPlayer} · ${gameData.lastProblemClaim.boardIndex + 1}번 문제 완성`
              : '각 문제의 모든 합을 상대보다 먼저 완성하세요.'}
          </p>
        </div>

        <div
          className={cn(
            'rounded-cdm-md mx-auto min-w-28 px-4 py-2 text-center',
            matchRemaining != null && matchRemaining <= 30
              ? 'bg-cdm-accent-soft'
              : 'bg-cdm-bg-elev-1',
          )}
        >
          <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-[0.16em]">TIME LEFT</p>
          <p
            className={cn(
              'text-2xl font-black tabular-nums',
              matchRemaining != null && matchRemaining <= 30 ? 'text-cdm-accent' : 'text-cdm-fg',
            )}
          >
            {matchRemaining == null ? '∞' : formatClock(matchRemaining)}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          {playerEntries.map(([playerId, player]) => (
            <div
              key={playerId}
              className="rounded-cdm-md border-cdm-border bg-cdm-bg-elev-1 min-w-24 border px-3 py-2"
            >
              <p className="text-cdm-fg-muted max-w-28 truncate text-[11px] font-semibold">
                {player.nickname}
                {playerId === myId ? ' (나)' : ''}
              </p>
              <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-wide">완성 문제</p>
              <p className="text-cdm-primary text-right text-xl font-black tabular-nums">
                {gameData.correctCounts[playerId] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-3">
        {gameData.boards.map((board, boardIndex) => (
          <BoardPanel
            key={boardIndex}
            board={board}
            boardIndex={boardIndex}
            players={gameData.players}
            myId={myId}
            selectable={isPlayer && gameData.phase === 'playing' && board.winnerId == null}
            picked={selection.boardIndex === boardIndex ? selection.indexes : []}
            onToggle={(cardIndex) => toggleCard(boardIndex, cardIndex)}
            onSubmit={() => submitHap(boardIndex)}
          />
        ))}
      </div>

      {!isPlayer && gameData.phase === 'playing' && (
        <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
      )}
      {gameData.playMode === 'com' && gameData.phase === 'playing' && (
        <p className="text-cdm-fg-muted text-center text-xs">
          COM도 동시에 보드를 탐색합니다. 각 문제의 모든 합을 먼저 완성하세요.
        </p>
      )}
      {gameData.phase === 'finished' && (
        <div className="rounded-cdm-lg bg-cdm-primary-soft p-4 text-center">
          <p className="text-cdm-primary text-sm font-extrabold">{gameData.finishReason}</p>
          <p className="text-cdm-fg-muted mt-1 text-xs">최종 결과를 집계하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}

function BoardPanel({
  board,
  boardIndex,
  players,
  myId,
  selectable,
  picked,
  onToggle,
  onSubmit,
}: {
  board: CompleteHapBoard;
  boardIndex: number;
  players: CompleteHapGameData['players'];
  myId: string;
  selectable: boolean;
  picked: number[];
  onToggle: (cardIndex: number) => void;
  onSubmit: () => void;
}) {
  return (
    <section
      className={cn(
        'rounded-cdm-lg bg-cdm-bg border-2 p-3 transition-colors',
        picked.length > 0 ? 'border-cdm-primary shadow-lg' : 'border-cdm-border',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-cdm-fg text-lg font-black">{boardIndex + 1}번 문제</h2>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-bold',
            board.winnerId
              ? 'bg-cdm-success-soft text-cdm-success'
              : 'bg-cdm-bg-elev-1 text-cdm-fg-muted',
          )}
        >
          {board.winnerId
            ? `${players[board.winnerId]?.nickname ?? '플레이어'} 완성`
            : `내 진행 ${board.progress[myId] ?? 0}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {board.cards.map((card, cardIndex) => (
          <PictureCard
            key={cardIndex}
            card={card}
            number={cardIndex + 1}
            selected={picked.includes(cardIndex)}
            selectable={selectable}
            onClick={() => onToggle(cardIndex)}
          />
        ))}
      </div>

      <div className="rounded-cdm-md bg-cdm-bg-elev-1 text-cdm-fg-muted mt-3 min-h-12 px-2.5 py-2 text-[11px] leading-relaxed">
        <span className="text-cdm-fg-subtle font-bold">내가 찾은 합</span>{' '}
        {board.myFoundSets.length === 0
          ? '아직 없음'
          : board.myFoundSets.map((set) => set.map((index) => index + 1).join('·')).join(' / ')}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className="text-cdm-fg-muted min-w-0 flex-1 truncate text-xs font-semibold">
          {picked.length > 0
            ? `선택 ${picked.map((index) => index + 1).join(' · ')}`
            : '카드 3장을 선택하세요'}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectable || picked.length !== 3}
          className="rounded-cdm-md bg-cdm-primary px-4 py-2.5 text-sm font-black text-white transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
        >
          합 외치기
        </button>
      </div>
    </section>
  );
}

function PictureCard({
  card,
  number,
  selected,
  selectable,
  onClick,
}: {
  card: CompleteHapCard;
  number: number;
  selected: boolean;
  selectable: boolean;
  onClick: () => void;
}) {
  const background = BACKGROUND_COLORS[card.background];
  const fill = SHAPE_COLORS[card.color];
  const labelColor = card.background === 'white' ? '#111318' : '#ffffff';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      aria-label={`${number}번 카드`}
      aria-pressed={selected}
      className={cn(
        'rounded-cdm-md relative aspect-[4/3] overflow-hidden border-2 transition-all',
        selected
          ? 'border-cdm-primary ring-cdm-primary/30 z-[1] scale-[1.04] ring-2'
          : 'border-cdm-border-strong',
        selectable && !selected && 'hover:border-cdm-primary cursor-pointer hover:-translate-y-0.5',
        !selectable && 'cursor-default',
      )}
    >
      <svg viewBox="0 0 100 75" className="h-full w-full" aria-hidden="true">
        <rect width="100" height="75" fill={background} />
        {card.shape === 'circle' && <circle cx="50" cy="38" r="22" fill={fill} />}
        {card.shape === 'triangle' && <polygon points="50,12 77,61 23,61" fill={fill} />}
        {card.shape === 'square' && (
          <rect x="27" y="15" width="46" height="46" rx="2" fill={fill} />
        )}
        <circle
          cx="12"
          cy="12"
          r="8"
          fill={card.background === 'white' ? 'rgba(255,255,255,.88)' : 'rgba(0,0,0,.48)'}
        />
        <text x="12" y="15.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={labelColor}>
          {number}
        </text>
      </svg>
      {selected && (
        <span className="bg-cdm-primary absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white">
          {number}
        </span>
      )}
    </button>
  );
}
