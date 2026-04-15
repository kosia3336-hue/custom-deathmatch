'use client';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { InvestDonateGameData } from '@/shared/types/invest-donate';
import { stockTotal } from '@/shared/types/invest-donate';
import CoinSelector from './CoinSelector';
import RevealPanel from './RevealPanel';
import InfoPanel from './InfoPanel';
import PlayerStatusCard from './PlayerStatusCard';
import RoundHistoryTable from './RoundHistoryTable';
import OpponentInferPanel from './OpponentInferPanel';
import { WIN_TYPE_LABELS } from './constants';

export default function InvestDonateGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as InvestDonateGameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();

  const shownWinnerRef = useRef<string | null>(null);

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

          {/* Mobile: compact score bar */}
          <div className="flex w-full max-w-lg justify-between gap-2 lg:hidden">
            {playerEntries.map(([id, p]) => {
              const isMe = id === myId;
              const myTotal = isMe ? stockTotal(p.coinStock) : null;
              return (
                <div
                  key={id}
                  className={`flex flex-1 items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                    isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className={`truncate font-medium ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {isMe ? '나' : p.nickname}
                  </span>
                  <span
                    className={`ml-1 shrink-0 tabular-nums font-bold ${
                      p.score <= 1 ? 'animate-pulse text-red-500' : 'text-gray-600'
                    }`}
                  >
                    {p.score}점
                  </span>
                  {myTotal !== null && (
                    <span className="ml-1 shrink-0 tabular-nums text-gray-400">{myTotal}원</span>
                  )}
                </div>
              );
            })}
          </div>

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
                    <span>✓ 제출 완료</span>
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

          {/* Mobile: round history (collapsible) */}
          <div className="w-full max-w-lg lg:hidden">
            {gameData.roundHistory.length > 0 && (
              <details className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600">
                  라운드 기록 ({gameData.roundHistory.length})
                </summary>
                <div className="border-t border-gray-100 px-3 py-2">
                  <RoundHistoryTable
                    history={gameData.roundHistory}
                    players={gameData.players}
                    compact
                  />
                </div>
              </details>
            )}
          </div>
        </div>

        {/* ── Desktop: info panel ── */}
        <div className="hidden lg:flex lg:w-60 lg:flex-col lg:border-l lg:border-gray-200 lg:p-4">
          <InfoPanel
            round={gameData.round}
            totalRounds={gameData.totalRounds}
            players={gameData.players}
            roundHistory={gameData.roundHistory}
            myId={myId ?? ''}
          />
        </div>
      </div>
    </div>
  );
}

