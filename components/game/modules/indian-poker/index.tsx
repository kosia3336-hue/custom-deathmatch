'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
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
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import RoundHistory from './RoundHistory';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';

export default function IndianPokerGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as IndianPokerGameData | undefined;
  const myId = useMySocketId();
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

  /* 상단 바 — 라운드·차례. 라운드 기록은 좁은 화면에서 '메모' 로 연다. */
  const { setHud } = useRoomLayout();
  const round = gameData?.round ?? 0;
  const phaseLabel = gameData?.phase === 'betting'
    ? gameData.currentTurnId === myId ? '내 베팅' : '상대 베팅'
    : gameData?.phase === 'dealing'
      ? '카드 배분'
      : gameData?.phase === 'finished'
        ? '종료'
        : gameData?.phase ? '카드 공개' : undefined;

  useEffect(() => {
    if (!gameData) return;
    setHud({
      // 덱이 도는 게임이라 총 라운드가 정해져 있지 않다. 몇 번째인지만 센다.
      round: `${round}R`,
      order: phaseLabel,
      memo: <IndianPokerSidePanel gameData={gameData} myId={myId} />,
    });
    return () => setHud(null);
  }, [setHud, gameData, round, myId, phaseLabel]);

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
      aside={<IndianPokerSidePanel gameData={gameData} myId={myId} />}
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

function IndianPokerSidePanel({ gameData, myId }: { gameData: IndianPokerGameData; myId: string }) {
  return (
    <GameInfoStack>
      <GameInfoPart title="플레이어">
        <div className="space-y-1.5">
          {Object.entries(gameData.players).map(([id, player]) => (
            <PlayerArea
              key={id}
              player={player}
              isMe={id === myId}
              isCurrentTurn={id === gameData.currentTurnId}
              timerRemaining={null}
            />
          ))}
        </div>
      </GameInfoPart>
      <GameInfoPart title="판 정보">
        <DeckInfo
          deckRemaining={gameData.deckRemaining}
          deckCycle={gameData.deckCycle}
          ante={gameData.ante}
          round={gameData.round}
        />
        <p className="mt-2 text-center text-sm font-black text-cdm-highlight">팟 {gameData.pot}</p>
      </GameInfoPart>
      <GameInfoPart>
        <RoundHistory roundHistory={gameData.roundHistory} players={gameData.players} />
      </GameInfoPart>
    </GameInfoStack>
  );
}
