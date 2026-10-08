'use client';
import { memo } from 'react';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameAction } from '@/components/game/GameActionContext';

import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useRef, useState } from 'react';
import type { CompleteHapCard, CompleteHapGameData } from '@/shared/types/complete-hap';
import { cn } from '@/lib/utils';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';

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

function setKey(indexes: number[]) {
  return [...indexes].sort((a, b) => a - b).join('-');
}

function CompleteHapView({
  gameData,
  myId,
}: GameModuleViewProps<CompleteHapGameData> & { isSolo?: boolean }) {
  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const playerEntries = Object.entries(gameData.players).sort(
    ([a], [b]) => Number(b === myId) - Number(a === myId),
  );
  const roundResult = gameData.lastRoundResult;
  const callerName = roundResult
    ? (gameData.players[roundResult.callerId]?.nickname ?? '플레이어')
    : null;
  const pointPlayerName = roundResult?.pointPlayerId
    ? (gameData.players[roundResult.pointPlayerId]?.nickname ?? '플레이어')
    : null;

  return (
    <RoundWorkspace
      key={`${gameData.matchStartedAt}:${gameData.round}`}
      gameData={gameData}
      myId={myId}
      isPlayer={isPlayer}
      playerEntries={playerEntries}
      callerName={callerName}
      pointPlayerName={pointPlayerName}
    />
  );
}

function RoundWorkspace({
  gameData,
  myId,
  isPlayer,
  playerEntries,
  callerName,
  pointPlayerName,
}: {
  gameData: CompleteHapGameData;
  myId: string;
  isPlayer: boolean;
  playerEntries: [string, { nickname: string }][];
  callerName: string | null;
  pointPlayerName: string | null;
}) {
  const sendAction = useGameAction();
  const [selection, setSelection] = useState<number[]>([]);
  const [savedSets, setSavedSets] = useState<number[][]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [tileSize, setTileSize] = useState(0);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const width = board.firstElementChild?.getBoundingClientRect().width ?? 0;
      setTileSize((previous) => (Math.abs(previous - width) < 0.5 ? previous : width));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    if (board.firstElementChild) observer.observe(board.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setHud } = useRoomLayout();
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
    sendAction({ type: 'call-gyul', sets: savedSets });
  }

  const cards = gameData.board.cards;
  const roundResult = gameData.lastRoundResult;
  const finished = gameData.phase === 'finished';
  const savedPanel = (
    <SavedList
      gameData={gameData}
      savedSets={savedSets}
      canPlay={canPlay}
      onRemove={removeSavedHap}
      tileSize={tileSize}
    />
  );
  const sidePanel = (
    <CompleteHapInfo
      gameData={gameData}
      myId={myId}
      savedPanel={savedPanel}
      playerEntries={playerEntries}
    />
  );

  useEffect(() => {
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order:
        gameData.phase === 'playing'
          ? gameData.isSolo
            ? '합 찾기'
            : '(공동 차례) 합 찾기'
          : gameData.phase === 'finished'
            ? '종료'
            : '라운드 판정',
    });
    return () => setHud(null);
  }, [gameData, setHud]);

  return (
    <>
      <GameReferenceFrame
        /*
          점수는 늘 보이게 둔다 — 4점이면 끝나는 판이라 몇 대 몇인지가 다음 수를
          정한다. 저장한 합 개수도 같이 적는다: 저장 목록이 메모 안에만 있어서
          몇 개 저장했는지조차 안 보였다. (components/game/GameScoreLine.tsx)
        */

        controls={
          <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={saveHap}
                disabled={!canPlay || selection.length !== 3}
                className="rounded-cdm-md bg-cdm-primary min-h-11 px-2 text-[12px] font-black text-white disabled:opacity-40"
              >
                합 저장
              </button>
              <button
                type="button"
                onClick={callGyul}
                disabled={!canPlay}
                className="rounded-cdm-md bg-cdm-accent min-h-11 px-2 text-[12px] font-black text-white disabled:opacity-40"
              >
                {isSubmitting ? '판정 중...' : '결 외치기'}
              </button>
            </div>
            <p
              className="text-cdm-fg-muted mt-1.5 flex min-h-6 items-center justify-center text-center text-[11px]"
              aria-live="polite"
            >
              {!isPlayer
                ? '실시간 경기를 관전하고 있습니다.'
                : selection.length === 0
                  ? '합이라고 생각하는 그림 3장을 고르세요.'
                  : `${selection.length}장 선택됨`}
            </p>
          </div>
        }
        reference={sidePanel}
      >
        <div
          ref={boardRef}
          data-game-intrinsic-stage
          className="mx-auto grid w-full grid-cols-3 gap-1.5 sm:gap-2"
          style={{ width: 'calc(100% - 1.5rem)', maxWidth: '30rem' }}
        >
          {cards.map((card, cardIndex) => (
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

        {(finished || (gameData.phase === 'round-result' && roundResult)) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div
              className={cn(
                'rounded-cdm-lg bg-cdm-bg/95 max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur',
                finished
                  ? 'border-cdm-primary'
                  : roundResult?.correct
                    ? 'border-cdm-success'
                    : 'border-cdm-accent',
              )}
            >
              {finished ? (
                <p className="text-cdm-primary text-sm font-black">{gameData.finishReason}</p>
              ) : (
                <>
                  <p
                    className={cn(
                      'text-base font-black',
                      roundResult?.correct ? 'text-cdm-success' : 'text-cdm-accent',
                    )}
                  >
                    {roundResult?.correct
                      ? '모든 합을 찾았습니다!'
                      : '저장한 합이 정답과 다릅니다.'}
                  </p>
                  <p className="text-cdm-fg-muted mt-1 text-xs">
                    {callerName ? `${callerName} 님이 결을 외쳤습니다. ` : ''}
                    {pointPlayerName
                      ? `${pointPlayerName} 님이 1점을 획득합니다.`
                      : '다음 라운드로 넘어갑니다.'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </GameReferenceFrame>
    </>
  );
}

function CompleteHapInfo({
  gameData,
  myId,
  savedPanel,
  playerEntries,
}: {
  gameData: CompleteHapGameData;
  myId: string;
  savedPanel: React.ReactNode;
  playerEntries: [string, { nickname: string }][];
}) {
  return (
    <GameInfoStack>
      <GameInfoPart title="점수" sizeToContent>
        <div className="grid grid-cols-2 gap-2">
          {playerEntries.map(([playerId, player]) => (
            <div
              key={playerId}
              className="bg-cdm-bg-elev-1 flex items-center justify-between rounded-md px-2.5 py-2 text-sm"
            >
              <span className="truncate font-semibold">
                {player.nickname}
                {playerId === myId ? ' (나)' : ''}
              </span>
              <span className="font-black tabular-nums">{gameData.scores[playerId] ?? 0}점</span>
            </div>
          ))}
        </div>
      </GameInfoPart>
      <GameInfoPart title="저장한 합" sizeToContent>
        {savedPanel}
      </GameInfoPart>
    </GameInfoStack>
  );
}

/**
 * 저장한 합 목록.
 *
 * 목록은 자연 높이를 유지하며, 화면보다 길면 공통 작업 영역이 스크롤한다.
 */
function SavedList({
  gameData,
  savedSets,
  canPlay,
  onRemove,
  tileSize,
}: {
  gameData: CompleteHapGameData;
  savedSets: number[][];
  canPlay: boolean;
  onRemove: (index: number) => void;
  tileSize: number;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-cdm-fg-muted text-[11px]">결을 외치기 전까지 수정할 수 있습니다.</p>
        </div>
        <span className="bg-cdm-bg-elev-1 text-cdm-fg rounded-full px-2.5 py-1 text-xs font-black tabular-nums">
          {savedSets.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {savedSets.length === 0 ? (
          <div className="border-cdm-border text-cdm-fg-muted rounded-cdm-md flex min-h-16 items-center justify-center border border-dashed px-4 text-center text-xs">
            저장한 합이 없습니다.
          </div>
        ) : (
          savedSets
            .map((set, savedIndex) => ({ set, savedIndex }))
            .reverse()
            .map(({ set, savedIndex }) => (
              <button
                key={setKey(set)}
                type="button"
                onClick={() => onRemove(savedIndex)}
                disabled={!canPlay}
                className="rounded-cdm-md relative grid w-full grid-cols-3 items-center gap-1.5 text-left disabled:cursor-default"
                style={{ maxWidth: tileSize > 0 ? `calc(${tileSize * 3}px + 0.75rem)` : undefined }}
                aria-label={`저장한 합 ${savedIndex + 1} 삭제`}
              >
                {set.map((cardIndex) => (
                  <PictureThumbnail key={cardIndex} card={gameData.board.cards[cardIndex]} />
                ))}
                <span
                  className="text-cdm-fg-muted bg-cdm-bg/90 absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-base"
                  aria-hidden="true"
                >
                  ×
                </span>
              </button>
            ))
        )}
      </div>
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
        'rounded-cdm-md focus-visible:outline-cdm-primary relative aspect-square overflow-hidden transition-all focus-visible:outline-2',
        selected && 'z-[1]',
        selectable && !selected && 'cursor-pointer hover:-translate-y-0.5',
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
    <span className="rounded-cdm-sm block aspect-square overflow-hidden">
      <PictureSvg card={card} />
    </span>
  );
}

export default memo(CompleteHapView);
