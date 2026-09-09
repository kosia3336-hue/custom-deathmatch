'use client';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { InvestDonateGameData } from '@/shared/types/invest-donate';
import CoinSelector from './CoinSelector';
import RevealPanel from './RevealPanel';
import InfoPanel from './InfoPanel';
import PlayerStatusCard from './PlayerStatusCard';
import OpponentInferPanel from './OpponentInferPanel';
import { WIN_TYPE_LABELS } from './constants';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';

export default function InvestDonateGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as InvestDonateGameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();
  const { setHud } = useRoomLayout();

  const shownWinnerRef = useRef<string | null>(null);
  const phaseLabel = gameData?.phase === 'submit'
    ? '코인 배분'
    : gameData?.phase === 'reveal'
      ? '결과 공개'
      : gameData?.phase === 'finished'
        ? '종료'
        : undefined;

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order: phaseLabel,
      memo: <InvestDonateSidePanel gameData={gameData} myId={myId ?? ''} />,
    });
    return () => setHud(null);
  }, [gameData, myId, phaseLabel, setHud]);

  useEffect(() => {
    if (!gameData?.winner || !gameData?.winType) return;
    if (shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;

    const winnerEntry = Object.entries(gameData.players).find(([id]) => id === gameData.winner);
    const winnerNick = winnerEntry?.[1].nickname ?? '???';
    const reason = gameData.winType ? (WIN_TYPE_LABELS[gameData.winType] ?? '') : '';
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
  const opponent = opponentEntry?.[1];

  const canAct = !isSpectator && gameData.phase === 'submit';
  const canCancel = myPlayer?.submitted && opponent && !opponent.submitted;

  const isSubmitPhase = gameData.phase === 'submit';
  const isRevealPhase = gameData.phase === 'reveal' || gameData.phase === 'finished';

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── Main area ── */}
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto p-2 lg:p-4">

          {/* Status message */}
          {gameState?.message && (
            <div className="text-center text-xs text-gray-400">{gameState.message}</div>
          )}

          <div className="w-full max-w-lg space-y-2">
            {/* Player status card — always visible */}
            <PlayerStatusCard
              players={gameData.players}
              roundHistory={gameData.roundHistory}
              myId={myId ?? ''}
              isSpectator={isSpectator}
            />

            {/* Submit phase */}
            {isSubmitPhase && (
              <>
                {/* My coin selector (players only) */}
                {canAct && myPlayer && (
                  <CoinSelector
                    coinStock={myPlayer.coinStock}
                    submitted={myPlayer.submitted}
                    submittedCoins={
                      myPlayer.investCoins && myPlayer.donateCoins
                        ? { invest: myPlayer.investCoins, donate: myPlayer.donateCoins }
                        : null
                    }
                    canCancel={!!canCancel}
                  />
                )}

                {/* If I submitted, waiting for opponent */}
                {!isSpectator && myPlayer?.submitted && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm text-emerald-600">
                    <span>제출 완료</span>
                    {opponent && !opponent.submitted && (
                      <>
                        <span className="text-gray-400">—</span>
                        <span className="animate-pulse text-gray-400">{opponent.nickname} 배분 중...</span>
                      </>
                    )}
                  </div>
                )}

                {/* Opponent coin display */}
                {!isSpectator && opponent && (
                  <OpponentInferPanel
                    opponentNickname={opponent.nickname}
                    opponentCoinStock={opponent.coinStock}
                  />
                )}

                {/* Spectator: two coin panels + waiting indicator */}
                {isSpectator && (
                  <>
                    <div className="flex gap-2">
                      {playerEntries.map(([id, p]) => (
                        <div key={id} className="flex-1">
                          <OpponentInferPanel
                            opponentNickname={p.nickname}
                            opponentCoinStock={p.coinStock}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm text-gray-400">
                      <span className="animate-pulse">●</span>
                      <span>●</span>
                      <span className="animate-pulse">●</span>
                      <span className="ml-1">플레이어들이 배분 중...</span>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Reveal / Finished */}
            {isRevealPhase && gameData.revealData && (
              <RevealPanel
                revealData={gameData.revealData}
                players={gameData.players}
                round={gameData.round}
                winner={gameData.winner}
                winType={gameData.winType}
                rematchReason={gameData.rematchReason}
              />
            )}
          </div>

        </div>

        {/* ── Desktop: info panel ── */}
        <div className="hidden lg:flex lg:w-72 lg:flex-col lg:p-3">
          <InvestDonateSidePanel gameData={gameData} myId={myId ?? ''} />
        </div>
      </div>
    </div>
  );
}

function InvestDonateSidePanel({ gameData, myId }: { gameData: InvestDonateGameData; myId: string }) {
  return (
    <GameInfoPart title="판 정보">
      <InfoPanel players={gameData.players} roundHistory={gameData.roundHistory} myId={myId} />
    </GameInfoPart>
  );
}
