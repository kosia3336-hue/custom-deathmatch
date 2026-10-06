'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import GameLoading from '@/components/game/GameLoading';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { getSocket } from '@/lib/socket';
import type { BettingRpsGameData } from '@/shared/types/betting-rps';
import BettingRpsView from './BettingRpsView';
import { buildBettingRpsView } from './viewModel';
import { WIN_TYPE_LABELS } from './constants';

export default function BettingRpsGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as BettingRpsGameData | undefined;
  const myId = useMySocketId() ?? '';
  const { remaining } = useTurnTimer();
  const { setHud } = useRoomLayout();
  const shownResult = useRef<string | null>(null);
  const phaseLabel = gameData
    ? buildBettingRpsView(gameData, myId, isSpectator).phaseLabel
    : undefined;

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order: (
        <span className="rounded-cdm-md bg-cdm-ink-border text-cdm-ink-fg px-1.5 py-0.5 text-[11px] font-bold">
          {phaseLabel}
        </span>
      ),
      memo: null,
    });
    return () => setHud(null);
  }, [gameData, phaseLabel, setHud]);

  useEffect(() => {
    if (!gameData?.winType) return;
    const resultKey = `${gameState?.startedAt}:${gameData.winType}:${gameData.winner}`;
    if (shownResult.current === resultKey) return;
    shownResult.current = resultKey;
    const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
    if (!gameData.winner) toast.info(reason, { duration: 5000 });
    else {
      const message = `${gameData.players[gameData.winner]?.nickname ?? '플레이어'} 승리! ${reason}`;
      if (isSpectator) toast.info(message, { duration: 5000 });
      else if (gameData.winner === myId) toast.success(message, { duration: 5000 });
      else toast.error(message, { duration: 5000 });
    }
  }, [gameData, gameState?.startedAt, myId, isSpectator]);

  if (!gameData)
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  return (
    <BettingRpsView
      gameData={gameData}
      myId={myId}
      isSpectator={isSpectator}
      disabled={remaining !== null && remaining <= 0}
      onAction={(action) => getSocket().emit('game:action', action)}
    />
  );
}
