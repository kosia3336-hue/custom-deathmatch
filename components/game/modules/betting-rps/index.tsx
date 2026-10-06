'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { BettingRpsGameData } from '@/shared/types/betting-rps';
import { brpsMatchWinBonus } from '@/shared/types/betting-rps';
import PlayerStatusCard from './PlayerStatusCard';
import RoleSelector from './RoleSelector';
import ResultSelector from './ResultSelector';
import BetSelector from './BetSelector';
import RevealPanel from './RevealPanel';
import InfoPanel from './InfoPanel';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import { WIN_TYPE_LABELS } from './constants';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';

export default function BettingRpsGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as BettingRpsGameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();
  const { setHud } = useRoomLayout();

  const shownWinnerRef = useRef<string | null>(null);
  const phaseLabel = gameData?.phase === 'roleSelect'
    ? '역할 선택'
    : gameData?.phase === 'submit'
      ? '결과·베팅 제출'
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
      memo: <BettingRpsSidePanel gameData={gameData} myId={myId ?? ''} />,
    });
    return () => setHud(null);
  }, [gameData, myId, phaseLabel, setHud]);

  useEffect(() => {
    if (!gameData) return;
    const { winner, winType } = gameData;

    // 무승부
    if (!winner && winType === 'draw') {
      if (shownWinnerRef.current === '__draw__') return;
      shownWinnerRef.current = '__draw__';
      toast('무승부!', { duration: 5000 });
      return;
    }

    if (!winner || !winType) return;
    if (shownWinnerRef.current === winner) return;
    shownWinnerRef.current = winner;

    const winnerNick = gameData.players[winner]?.nickname ?? '???';
    const reason = WIN_TYPE_LABELS[winType] ?? '';
    const isMe = winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) toast.success(message, { duration: 5000 });
    else toast.error(message, { duration: 5000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];
  const opponent = playerEntries.find(([id]) => id !== myId)?.[1];

  const isRoleSelectPhase = gameData.phase === 'roleSelect';
  const isSubmitPhase = gameData.phase === 'submit';
  const isRevealPhase = gameData.phase === 'reveal' || gameData.phase === 'finished';

  const iMyTurn = !isSpectator && isRoleSelectPhase && myPlayer?.hasChoiceRight;
  const iAmMatch = !isSpectator && isSubmitPhase && myPlayer?.role === 'match';
  const iAmBet = !isSpectator && isSubmitPhase && myPlayer?.role === 'bet';
  const waitingForOpponent = !isSpectator && isSubmitPhase && myPlayer?.submitted;

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── Main area ── */}
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto p-2 lg:p-4">

          <div className="w-full max-w-lg space-y-2">
            {/* Player status card */}
            <PlayerStatusCard
              players={gameData.players}
              myId={myId ?? ''}
              isSpectator={isSpectator}
            />

            {/* Spectator waiting overlay (roleSelect + submit) */}
            {isSpectator && (isRoleSelectPhase || isSubmitPhase) && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm text-gray-400">
                <span className="animate-pulse">●</span>
                <span>●</span>
                <span className="animate-pulse">●</span>
                <span className="ml-1">플레이어들이 선택 중...</span>
              </div>
            )}

            {/* Role select phase (players only) */}
            {!isSpectator && isRoleSelectPhase && (
              <>
                {iMyTurn ? (
                  <RoleSelector round={gameData.round} />
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-3 text-sm text-amber-700">
                    <span className="animate-pulse">●</span>
                    <span>상대가 역할을 선택 중...</span>
                  </div>
                )}
              </>
            )}

            {/* Submit phase (players only) */}
            {!isSpectator && isSubmitPhase && (
              <>
                {iAmMatch && !myPlayer?.submitted && (
                  <ResultSelector />
                )}
                {iAmBet && !myPlayer?.submitted && (
                  <BetSelector myChips={myPlayer?.chips ?? 0} />
                )}
                {waitingForOpponent && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm text-emerald-600">
                    <span>제출 완료</span>
                    <span className="text-gray-400">—</span>
                    <span className="animate-pulse text-gray-400">{opponentDisplayName(opponent?.nickname)} 선택 중...</span>
                  </div>
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
              />
            )}

          </div>

        </div>

        {/* ── Desktop: info panel ── */}
        <div className="hidden lg:flex lg:w-72 lg:flex-col lg:p-3">
          <BettingRpsSidePanel gameData={gameData} myId={myId ?? ''} />
        </div>
      </div>
    </div>
  );
}

function BettingRpsSidePanel({ gameData, myId }: { gameData: BettingRpsGameData; myId: string }) {
  return (
    <GameInfoPart title={`판 정보 · 이번 승리 +${brpsMatchWinBonus(gameData.round)}칩`}>
      <InfoPanel players={gameData.players} roundHistory={gameData.roundHistory} myId={myId} />
    </GameInfoPart>
  );
}
