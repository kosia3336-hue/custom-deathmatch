'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameHud } from '@/hooks/useGameHud';
import { usePresentationEffect } from '@/hooks/usePresentationEffect';
import { submitStage } from '@/lib/gameSeat';
import type { SkinTheme } from '@/lib/skins/registry';
import type { WinningStreakGameData, WSCardType } from '@/shared/types/winning-streak';
import { WS_TOTAL_ROUNDS } from '@/shared/types/winning-streak';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CardModal } from './CardModal';
import { WIN_TYPE_LABELS } from './constants';
import { getAvailableCards } from './getAvailableCards';
import { MyCardHand } from './MyCardHand';
import { ModalCard } from './presentation';
import { RevealArea } from './RevealArea';
import { WinningStreakSidePanel } from './WinningStreakSidePanel';

function WinningStreakView({
  gameData,
  myId,
  isSpectator = false,
}: {
  gameData?: WinningStreakGameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const sendAction = useGameAction();

  const [modalCard, setModalCard] = useState<ModalCard | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shownWinnerRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const [roundOverlay, setRoundOverlay] = useState<number | null>(null);

  /*
    동시에 내는 판이라 '내 차례' 는 뜻이 없다 — 둘 다 차례다. 대신 내가 이미
    냈는지를 알려 준다. 그게 이 단계에서 실제로 궁금한 것이다. (lib/gameSeat.ts)
  */
  const phaseLabel =
    gameData?.phase === 'cardSelect'
      ? submitStage({
          finished: false,
          isSpectator,
          submitted: (myId ? gameData.players[myId]?.submitted : false) ?? false,
          pending: '(공동 차례) 카드 선택',
        })
      : gameData?.phase === 'reveal' || gameData?.phase === 'result'
        ? '카드 공개'
        : gameData?.phase === 'finished'
          ? '종료'
          : undefined;

  useGameHud(
    gameData ? { round: `${gameData.round} / ${WS_TOTAL_ROUNDS}R`, order: phaseLabel } : null,
  );

  const handleCardClick = useCallback(
    (type: WSCardType, index: number, isLocked: boolean) => {
      if (submitting || isSpectator) return;
      if (isLocked) {
        toast.warning('직전 라운드에 낸 카드는 연속으로 낼 수 없습니다.', { duration: 2500 });
        return;
      }
      setModalCard({ type, index });
    },
    [submitting, isSpectator],
  );

  const handleCloseModal = useCallback(() => setModalCard(null), []);

  const handleSubmitFromModal = useCallback(() => {
    if (!modalCard || submitting) return;
    setSubmitting(true);
    sendAction({ type: 'selectCard', card: modalCard.type });
    setModalCard(null);
    setTimeout(() => setSubmitting(false), 500);
  }, [modalCard, submitting, sendAction]);

  // Reset on new round
  usePresentationEffect(() => {
    if (!gameData) return;
    if (prevRoundRef.current !== null && prevRoundRef.current !== gameData.round) {
      setModalCard(null);
      setSubmitting(false);
      setRoundOverlay(gameData.round);
      prevRoundRef.current = gameData.round;
      const t = setTimeout(() => setRoundOverlay(null), 2000);
      return () => clearTimeout(t);
    }
    prevRoundRef.current = gameData.round;
  }, [gameData?.round]);

  usePresentationEffect(() => {
    if (gameData?.phase === 'cardSelect') setSubmitting(false);
  }, [gameData?.phase]);

  useEffect(() => {
    if (!gameData?.winType) return;
    if (gameData.winType === 'draw') {
      if (shownWinnerRef.current === 'draw') return;
      shownWinnerRef.current = 'draw';
      toast.info('무승부!', { duration: 5000 });
      return;
    }
    if (!gameData.winner || shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;
    const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
    const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
    const isMe = gameData.winner === myId;
    if (isMe) toast.success(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
    else toast.error(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GameLoading label="로딩 중" />
      </div>
    );
  }

  const playerIds = Object.keys(gameData.players);
  const myPlayer = myId ? gameData.players[myId] : null;
  const isCardSelect = gameData.phase === 'cardSelect';
  const isRevealing = gameData.phase === 'reveal' || gameData.phase === 'result';
  const isFinished = gameData.phase === 'finished';
  const mySubmitted = myPlayer?.submitted ?? false;
  const canAct = isCardSelect && !isSpectator && !mySubmitted && !isFinished;
  const availableCards = myPlayer
    ? getAvailableCards(myPlayer.remainingCards, myPlayer.lastPlayedCard)
    : [];

  return (
    <>
      {/* ── 카드 선택 모달 ── */}
      {modalCard && (
        <CardModal
          card={modalCard.type}
          onClose={handleCloseModal}
          onSubmit={handleSubmitFromModal}
          submitting={submitting}
        />
      )}

      <GameReferenceFrame reference={<WinningStreakSidePanel gameData={gameData} myId={myId} />}>
        <div
          data-game-panel
          className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-3"
        >
          {isCardSelect && (
            <div className="w-full">
              {' '}
              {myPlayer && !isSpectator && (
                <MyCardHand
                  cards={myPlayer.remainingCards}
                  lastPlayed={myPlayer.lastPlayedCard}
                  available={availableCards}
                  onCardClick={handleCardClick}
                  canAct={canAct}
                  submitted={mySubmitted}
                />
              )}
            </div>
          )}
          {isRevealing && gameData.revealData ? (
            <RevealArea
              revealData={gameData.revealData}
              playerIds={playerIds}
              players={gameData.players}
              myId={myId}
            />
          ) : isCardSelect ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              {mySubmitted ? (
                <span className="animate-pulse text-sm text-indigo-500 lg:text-base">
                  상대의 제출을 기다리는 중...
                </span>
              ) : null}
            </div>
          ) : isFinished ? (
            <div className="text-center">
              <p className="mt-2 text-xl font-bold text-gray-800 lg:text-2xl">
                {gameData.winner
                  ? `${gameData.players[gameData.winner]?.nickname} 승리!`
                  : '무승부!'}
              </p>
              {gameData.winType && (
                <p className="mt-1 text-sm text-gray-500 lg:text-base">
                  {WIN_TYPE_LABELS[gameData.winType] ?? gameData.winType}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {roundOverlay !== null && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="animate-bounce rounded-xl bg-indigo-600 px-8 py-4 text-2xl font-bold text-white shadow-xl">
              라운드 {roundOverlay}
            </div>
          </div>
        )}
      </GameReferenceFrame>
    </>
  );
}

export default memo(WinningStreakView);
