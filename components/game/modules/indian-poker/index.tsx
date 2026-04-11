'use client';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { IndianPokerGameData } from '@/shared/types/indian-poker';
import CardArea from './CardArea';
import BettingPanel from './BettingPanel';
import PlayerArea from './PlayerArea';
import HandResult from './HandResult';
import DeckInfo from './DeckInfo';
import { WIN_TYPE_LABELS } from './constants';

export default function IndianPokerGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as IndianPokerGameData | undefined;
  const myId = useMySocketId();
  const { remaining: timerRemaining } = useTurnTimer();

  const shownWinnerRef = useRef<string | null>(null);
  const shownDeckResetRef = useRef<number>(0);

  useEffect(() => {
    if (!gameData?.deckResetOccurred) return;
    if (shownDeckResetRef.current === gameData.deckCycle) return;
    shownDeckResetRef.current = gameData.deckCycle;
    toast.info(`🔀 덱 리셋! 앤트가 ${gameData.ante}개로 올랐습니다.`, { duration: 4000 });
  }, [gameData?.deckResetOccurred, gameData?.deckCycle, gameData?.ante]);

  useEffect(() => {
    if (!gameData?.winner || !gameData?.winType) return;
    if (shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;

    const winnerP = gameData.players[gameData.winner];
    const winnerNick = winnerP?.nickname ?? '???';
    const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
    const isMe = gameData.winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) toast.success(message, { duration: 5000 });
    else toast.error(message, { duration: 5000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];
  const opponentEntry = playerEntries.find(([id]) => id !== myId);
  const opponentPlayer = opponentEntry?.[1];
  const opponentId = opponentEntry?.[0];

  const isMyTurn = gameData.currentTurnId === myId && !isSpectator;
  const canCheck = !gameData.bettingStarted && gameData.currentTurnId === gameData.firstBettorId;
  const isBettingPhase = gameData.phase === 'betting';
  const isResultPhase = gameData.phase === 'showdown' || gameData.phase === 'dieResult' || gameData.phase === 'finished';

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* 메인 영역 */}
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-2 lg:p-4">
          {/* 모바일: 플레이어 바 */}
          <div className="flex w-full max-w-lg gap-2 lg:hidden">
            {playerEntries.map(([id, p]) => (
              <div key={id} className="flex-1">
                <PlayerArea
                  player={p}
                  isMe={id === myId}
                  isCurrentTurn={id === gameData.currentTurnId}
                  timerRemaining={id === gameData.currentTurnId ? timerRemaining : null}
                />
              </div>
            ))}
          </div>

          {/* 상태 메시지 */}
          <div className="text-center text-sm text-gray-500 lg:text-base">
            {gameState?.message}
          </div>

          {/* 덱 정보 */}
          <DeckInfo
            deckRemaining={gameData.deckRemaining}
            deckCycle={gameData.deckCycle}
            ante={gameData.ante}
            round={gameData.round}
          />

          {/* 팟 */}
          <div className="text-center">
            <span className="rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-800 lg:text-base">
              💰 팟: {gameData.pot}
            </span>
          </div>

          {/* 카드 영역 */}
          <div className="w-full max-w-lg">
            <CardArea
              communityCards={gameData.communityCards}
              myPlayer={isSpectator ? undefined : myPlayer}
              opponentPlayer={isSpectator ? undefined : opponentPlayer}
              revealMyCard={isResultPhase}
            />
          </div>

          {/* 베팅 / 결과 */}
          <div className="w-full max-w-lg">
            {isBettingPhase && (
              <BettingPanel
                isMyTurn={isMyTurn}
                canCheck={canCheck}
                myPlayer={myPlayer!}
                opponentPlayer={opponentPlayer}
                pot={gameData.pot}
                isSpectator={isSpectator}
                currentRoundActions={gameData.currentRoundActions ?? []}
                players={gameData.players}
                opponentId={opponentId}
                myId={myId ?? undefined}
              />
            )}

            {isResultPhase && (
              <HandResult
                showdownData={gameData.showdownData}
                dieData={gameData.dieData}
                players={gameData.players}
                winner={gameData.winner}
                winType={gameData.winType}
              />
            )}

            {gameData.phase === 'dealing' && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
                <div className="animate-pulse text-gray-400">●  ●  ●</div>
                <p className="text-sm text-gray-500">카드를 배분하는 중...</p>
              </div>
            )}
          </div>

        </div>

        {/* 데스크탑: 사이드 패널 */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:gap-4 lg:border-l lg:border-gray-200 lg:p-4">
          {playerEntries.map(([id, p]) => (
            <PlayerArea
              key={id}
              player={p}
              isMe={id === myId}
              isCurrentTurn={id === gameData.currentTurnId}
              timerRemaining={id === gameData.currentTurnId ? timerRemaining : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
