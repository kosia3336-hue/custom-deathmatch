'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import { GAME_IDS } from '@/shared/types/game';
import { getSkinTheme } from '@/lib/skins/registry';
import type { IndianPokerGameData } from '@/shared/types/indian-poker';
import CardArea from './CardArea';
import BettingPanel from './BettingPanel';
import PlayerArea from './PlayerArea';
import HandResult from './HandResult';
import DeckInfo from './DeckInfo';
import { useNocturneDealReveal } from './skins/useNocturneDealReveal';
import { WIN_TYPE_LABELS } from './constants';
import { GameFrame } from '@/components/game/GameFrame';

export default function IndianPokerGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as IndianPokerGameData | undefined;
  const myId = useMySocketId();
  const { remaining: timerRemaining } = useTurnTimer();
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.INDIAN_POKER);

  const shownWinnerRef = useRef<string | null>(null);
  const prevDeckCycleRef = useRef<number | null>(null);
  const [showShuffle, setShowShuffle] = useState(false);
  const [shuffleAnte, setShuffleAnte] = useState(0);

  const { dealStep } = useNocturneDealReveal({
    enabled: skin === 'nocturne',
    round: gameData?.round ?? 0,
    phase: gameData?.phase ?? '',
    blockAnim: showShuffle,
  });

  useEffect(() => {
    if (!gameData) return;
    const prev = prevDeckCycleRef.current;
    prevDeckCycleRef.current = gameData.deckCycle;
    if (prev === null || gameData.deckCycle <= prev) return;
    setShuffleAnte(gameData.ante);
    setShowShuffle(true);
    const t = setTimeout(() => setShowShuffle(false), 2800);
    return () => clearTimeout(t);
  }, [gameData?.deckCycle, gameData?.ante]);

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

  const activeTurnEntry = playerEntries.find(([id]) => id === gameData.currentTurnId);
  const passiveTurnEntry = playerEntries.find(([id]) => id !== gameData.currentTurnId);
  const bettingMyPlayer = isSpectator ? (activeTurnEntry?.[1] ?? myPlayer!) : myPlayer!;
  const bettingOpponent = isSpectator ? passiveTurnEntry?.[1] : opponentPlayer;
  const bettingMyId = isSpectator ? (gameData.currentTurnId ?? undefined) : (myId ?? undefined);
  const bettingOpponentId = isSpectator ? passiveTurnEntry?.[0] : opponentId;

  return (
    <>
    {skin !== 'nocturne' && (
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-500 ${
          showShuffle ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className={`flex flex-col items-center gap-4 rounded-3xl border border-indigo-400/30 bg-indigo-900/95 px-12 py-8 text-center text-white shadow-2xl backdrop-blur-sm transition-transform duration-500 ${
            showShuffle ? 'scale-100' : 'scale-90'
          }`}
        >
          <div>
            <p className="text-2xl font-bold tracking-wide">카드를 셔플합니다</p>
            <p className="mt-1 text-sm text-indigo-300">앤티 {shuffleAnte}개로 인상됩니다</p>
          </div>
        </div>
      </div>
    )}

    <GameFrame
      info={
        <div className="flex flex-col gap-1">
          <div className="flex w-full gap-2">
            {playerEntries.map(([id, p]) => (
              <div key={id} className="min-w-0 flex-1">
                <PlayerArea
                  player={p}
                  isMe={id === myId}
                  isCurrentTurn={id === gameData.currentTurnId}
                  timerRemaining={id === gameData.currentTurnId ? timerRemaining : null}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
            <DeckInfo
              deckRemaining={gameData.deckRemaining}
              deckCycle={gameData.deckCycle}
              ante={gameData.ante}
              round={gameData.round}
            />
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              팟 {gameData.pot}
            </span>
            <span className="text-[11px] leading-4 text-gray-500">{gameState?.message}</span>
          </div>
        </div>
      }
      controls={
        <div className="w-full">
          {isBettingPhase && (
            <BettingPanel
              isMyTurn={isMyTurn}
              canCheck={canCheck}
              myPlayer={bettingMyPlayer}
              opponentPlayer={bettingOpponent}
              pot={gameData.pot}
              isSpectator={isSpectator}
              currentRoundActions={gameData.currentRoundActions ?? []}
              players={gameData.players}
              opponentId={bettingOpponentId}
              myId={bettingMyId}
              skin={skin}
            />
          )}
        </div>
      }
    >
      <div className="flex h-full w-full max-w-lg flex-col items-center justify-center gap-2 overflow-hidden">
        <CardArea
          communityCards={gameData.communityCards}
          myPlayer={isSpectator ? playerEntries[1]?.[1] : myPlayer}
          opponentPlayer={isSpectator ? playerEntries[0]?.[1] : opponentPlayer}
          revealMyCard={isResultPhase}
          isSpectator={isSpectator}
          skin={skin}
          dealStep={dealStep}
          showShuffle={showShuffle}
        />

        {isResultPhase && (
          <div className="w-full">
            <HandResult
              showdownData={gameData.showdownData}
              dieData={gameData.dieData}
              players={gameData.players}
              winner={gameData.winner}
              winType={gameData.winType}
              communityCards={gameData.communityCards}
              skin={skin}
            />
          </div>
        )}

        {gameData.phase === 'dealing' && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
            <div className="animate-pulse text-gray-400">● ● ●</div>
            <p className="text-sm text-gray-500">카드를 배분하는 중...</p>
          </div>
        )}
      </div>
    </GameFrame>
    </>
  );
}
