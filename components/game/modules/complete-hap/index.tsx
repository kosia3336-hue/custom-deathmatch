'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useState } from 'react';
import type { CompleteHapCard, CompleteHapGameData } from '@/shared/types/complete-hap';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { GameFrame, fitBoardWidth } from '@/components/game/GameFrame';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GameScoreLine } from '@/components/game/GameScoreLine';

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

export default function CompleteHapGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as CompleteHapGameData | undefined;
  const myId = useMySocketId();

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const playerEntries = Object.entries(gameData.players);
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
  const [selection, setSelection] = useState<number[]>([]);
  const [savedSets, setSavedSets] = useState<number[][]>([]);
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
    getSocket().emit('game:action', { type: 'call-gyul', sets: savedSets });
  }

  const cards = gameData.board.cards;
  const rows = Math.ceil(cards.length / 3);
  const roundResult = gameData.lastRoundResult;
  const finished = gameData.phase === 'finished';
  const savedPanel = (
    <SavedList
      gameData={gameData}
      savedSets={savedSets}
      canPlay={canPlay}
      onRemove={removeSavedHap}
    />
  );
  const sidePanel = (
    <CompleteHapInfo gameData={gameData} myId={myId} savedPanel={savedPanel} playerEntries={playerEntries} />
  );

  useEffect(() => {
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order:
        gameData.phase === 'playing'
          ? '합 찾기'
          : gameData.phase === 'finished'
            ? '종료'
            : '라운드 판정',
      memo: (
        <CompleteHapInfo
          gameData={gameData}
          myId={myId}
          savedPanel={savedPanel}
          playerEntries={playerEntries}
        />
      ),
    });
    return () => setHud(null);
    // setHud가 부모를 다시 그리므로 매 렌더마다 새로 만들어지는 JSX 조각은 의존성에서 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData, savedSets, setHud]);

  return (
    <>
      <GameFrame
        /*
          점수는 늘 보이게 둔다 — 4점이면 끝나는 판이라 몇 대 몇인지가 다음 수를
          정한다. 저장한 합 개수도 같이 적는다: 저장 목록이 메모 안에만 있어서
          몇 개 저장했는지조차 안 보였다. (components/game/GameScoreLine.tsx)
        */
        info={
          <div className="lg:hidden">
            <GameScoreLine
              unit="점"
              entries={playerEntries.map(([playerId, player]) => ({
                label: playerId === myId ? '나' : player.nickname,
                isMe: playerId === myId,
                value: gameData.scores[playerId] ?? 0,
                hint: playerId === myId ? `합 ${savedSets.length}개` : undefined,
              }))}
            />
          </div>
        }
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
        aside={sidePanel}
      >
        <div
          className="mx-auto grid w-full grid-cols-3 gap-1.5 sm:gap-2"
          style={{ maxWidth: fitBoardWidth(3, rows, '30rem') }}
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
      </GameFrame>
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
        <div className="space-y-1.5">
          {playerEntries.map(([playerId, player]) => (
            <div
              key={playerId}
              className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-2 text-sm"
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
      <GameInfoPart title="저장한 합">{savedPanel}</GameInfoPart>
    </GameInfoStack>
  );
}

/**
 * 저장한 합 목록.
 *
 * 길이가 정해지지 않은 목록이라 여기만 스크롤을 허용한다. 뼈대(GameFrame)가
 * 스크롤되는 것과는 다르다 — 판과 조작부는 늘 제자리에 있다.
 */
function SavedList({
  gameData,
  savedSets,
  canPlay,
  onRemove,
}: {
  gameData: CompleteHapGameData;
  savedSets: number[][];
  canPlay: boolean;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-cdm-lg border-cdm-border bg-cdm-bg flex h-full min-h-0 flex-col border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-cdm-fg text-sm font-black">저장한 합</p>
          <p className="text-cdm-fg-muted text-[11px]">결을 외치기 전까지 수정할 수 있습니다.</p>
        </div>
        <span className="bg-cdm-bg-elev-1 text-cdm-fg rounded-full px-2.5 py-1 text-xs font-black tabular-nums">
          {savedSets.length}
        </span>
      </div>
      <div className="mt-3 max-h-72 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
        {savedSets.length === 0 ? (
          <div className="border-cdm-border text-cdm-fg-muted rounded-cdm-md flex min-h-16 items-center justify-center border border-dashed px-4 text-center text-xs">
            저장한 합이 없습니다.
          </div>
        ) : (
          savedSets.map((set, savedIndex) => (
            <button
              key={setKey(set)}
              type="button"
              onClick={() => onRemove(savedIndex)}
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
