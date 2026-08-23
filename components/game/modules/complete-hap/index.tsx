'use client';

import { useEffect, useState } from 'react';
import type { CompleteHapCard, CompleteHapGameData } from '@/shared/types/complete-hap';
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

function setKey(indexes: number[]) {
  return [...indexes].sort((a, b) => a - b).join('-');
}

export default function CompleteHapGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as CompleteHapGameData | undefined;
  const myId = useMySocketId();
  const [now, setNow] = useState(gameData?.matchStartedAt ?? 0);

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
  const roundResult = gameData.lastRoundResult;
  const callerName = roundResult
    ? (gameData.players[roundResult.callerId]?.nickname ?? '플레이어')
    : null;
  const pointPlayerName = roundResult?.pointPlayerId
    ? (gameData.players[roundResult.pointPlayerId]?.nickname ?? '플레이어')
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="rounded-cdm-lg border-cdm-border bg-cdm-bg grid gap-3 border p-3 shadow-sm md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="min-w-0">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.18em]">
            ROUND {gameData.round} / {gameData.totalRounds}
          </p>
          <p className="text-cdm-fg truncate text-sm font-extrabold">
            {gameData.phase === 'finished' ? '게임 종료' : '모든 합을 저장하고 결을 외치세요'}
          </p>
          <p className="text-cdm-fg-muted truncate text-xs">
            {roundResult
              ? roundResult.correct
                ? `${callerName} 정답`
                : `${callerName} 오답${pointPlayerName ? ` · ${pointPlayerName} 득점` : ''}`
              : '먼저 결을 외친 플레이어의 저장 목록을 한 번에 판정합니다.'}
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
              <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-wide">득점</p>
              <p className="text-cdm-primary text-right text-xl font-black tabular-nums">
                {gameData.scores[playerId] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </header>

      <RoundWorkspace
        key={`${gameData.matchStartedAt}:${gameData.round}`}
        gameData={gameData}
        isPlayer={isPlayer}
      />

      {gameData.phase === 'round-result' && roundResult && (
        <div
          className={cn(
            'rounded-cdm-lg p-4 text-center',
            roundResult.correct ? 'bg-cdm-success-soft' : 'bg-cdm-accent-soft',
          )}
        >
          <p
            className={cn(
              'text-base font-black',
              roundResult.correct ? 'text-cdm-success' : 'text-cdm-accent',
            )}
          >
            {roundResult.correct ? '모든 합을 찾았습니다!' : '저장한 합이 정답과 다릅니다.'}
          </p>
          <p className="text-cdm-fg-muted mt-1 text-xs">
            {pointPlayerName
              ? `${pointPlayerName} 님이 1점을 획득합니다.`
              : '다음 라운드로 넘어갑니다.'}
          </p>
        </div>
      )}
      {!isPlayer && gameData.phase === 'playing' && (
        <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
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

function RoundWorkspace({
  gameData,
  isPlayer,
}: {
  gameData: CompleteHapGameData;
  isPlayer: boolean;
}) {
  const [selection, setSelection] = useState<number[]>([]);
  const [savedSets, setSavedSets] = useState<number[][]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canPlay = isPlayer && gameData.phase === 'playing' && !isSubmitting;

  function toggleCard(cardIndex: number) {
    if (!canPlay) return;
    setSelection((current) => {
      if (current.includes(cardIndex)) return current.filter((index) => index !== cardIndex);
      if (current.length >= 3) return current;
      return [...current, cardIndex];
    });
  }

  function saveHap() {
    if (!canPlay || selection.length !== 3) return;
    const sorted = [...selection].sort((a, b) => a - b);
    setSavedSets((current) =>
      current.some((saved) => setKey(saved) === setKey(sorted)) ? current : [...current, sorted],
    );
    setSelection([]);
  }

  function removeSavedHap(savedIndex: number) {
    if (!canPlay) return;
    setSavedSets((current) => current.filter((_, index) => index !== savedIndex));
  }

  function callGyul() {
    if (!canPlay) return;
    setIsSubmitting(true);
    getSocket().emit('game:action', { type: 'call-gyul', sets: savedSets });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-cdm-lg border-cdm-border bg-cdm-bg border p-3 sm:p-4">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
          {gameData.board.cards.map((card, cardIndex) => (
            <PictureCard
              key={cardIndex}
              card={card}
              cardIndex={cardIndex}
              selected={selection.includes(cardIndex)}
              selectable={canPlay}
              onClick={() => toggleCard(cardIndex)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <p className="text-cdm-fg-muted min-w-0 flex-1 text-xs font-semibold">
            {selection.length === 0
              ? '합이라고 생각하는 그림 3장을 선택하세요.'
              : `${selection.length}장 선택됨`}
          </p>
          <button
            type="button"
            onClick={saveHap}
            disabled={!canPlay || selection.length !== 3}
            className="rounded-cdm-md bg-cdm-primary px-4 py-2.5 text-sm font-black text-white transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
          >
            합 저장
          </button>
        </div>
      </section>

      <aside className="rounded-cdm-lg border-cdm-border bg-cdm-bg flex min-h-56 flex-col border p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-cdm-fg text-sm font-black">저장한 합</p>
            <p className="text-cdm-fg-muted text-[11px]">결을 외치기 전까지 수정할 수 있습니다.</p>
          </div>
          <span className="bg-cdm-bg-elev-1 text-cdm-fg rounded-full px-2.5 py-1 text-xs font-black tabular-nums">
            {savedSets.length}
          </span>
        </div>

        <div className="mt-3 flex-1 space-y-2">
          {savedSets.length === 0 ? (
            <div className="border-cdm-border text-cdm-fg-muted rounded-cdm-md flex min-h-24 items-center justify-center border border-dashed px-4 text-center text-xs">
              저장한 합이 없습니다.
            </div>
          ) : (
            savedSets.map((set, savedIndex) => (
              <button
                key={setKey(set)}
                type="button"
                onClick={() => removeSavedHap(savedIndex)}
                disabled={!canPlay}
                className="border-cdm-border bg-cdm-bg-elev-1 hover:border-cdm-accent rounded-cdm-md grid w-full grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5 border p-2 text-left disabled:cursor-default"
                aria-label={`저장한 합 ${savedIndex + 1} 삭제`}
              >
                {set.map((cardIndex) => (
                  <PictureThumbnail key={cardIndex} card={gameData.board.cards[cardIndex]} />
                ))}
                <span className="text-cdm-fg-muted px-1 text-base" aria-hidden="true">
                  ×
                </span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={callGyul}
          disabled={!canPlay}
          className="rounded-cdm-md bg-cdm-accent mt-3 w-full px-4 py-3 text-base font-black text-white transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
        >
          {isSubmitting ? '판정 중...' : '결 외치기'}
        </button>
      </aside>
    </div>
  );
}

function PictureSvg({ card }: { card: CompleteHapCard }) {
  const background = BACKGROUND_COLORS[card.background];
  const fill = SHAPE_COLORS[card.color];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <rect width="100" height="100" fill={background} />
      {card.shape === 'circle' && <circle cx="50" cy="50" r="25" fill={fill} />}
      {card.shape === 'triangle' && <polygon points="50,17 80,76 20,76" fill={fill} />}
      {card.shape === 'square' && <rect x="27" y="27" width="46" height="46" rx="2" fill={fill} />}
    </svg>
  );
}

function PictureCard({
  card,
  cardIndex,
  selected,
  selectable,
  onClick,
}: {
  card: CompleteHapCard;
  cardIndex: number;
  selected: boolean;
  selectable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      aria-label={`${cardIndex + 1}번째 그림`}
      aria-pressed={selected}
      className={cn(
        'rounded-cdm-md relative aspect-square overflow-hidden border-2 transition-all',
        selected
          ? 'border-cdm-primary ring-cdm-primary/30 z-[1] scale-[1.035] ring-2'
          : 'border-cdm-border-strong',
        selectable && !selected && 'hover:border-cdm-primary cursor-pointer hover:-translate-y-0.5',
        !selectable && 'cursor-default',
      )}
    >
      <PictureSvg card={card} />
      {selected && (
        <span className="bg-cdm-primary absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white">
          ✓
        </span>
      )}
    </button>
  );
}

function PictureThumbnail({ card }: { card: CompleteHapCard }) {
  return (
    <span className="rounded-cdm-sm border-cdm-border-strong block aspect-square overflow-hidden border">
      <PictureSvg card={card} />
    </span>
  );
}
