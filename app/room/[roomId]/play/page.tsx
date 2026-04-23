'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ComponentType } from 'react';
import GameShell from '@/components/game/GameShell';
import FourGravityGame from '@/components/game/modules/four-gravity';
import DoubleSidedChessGame from '@/components/game/modules/double-sided-chess';
import NumberFourGame from '@/components/game/modules/number4';
import IndianPokerGame from '@/components/game/modules/indian-poker';
import InvestDonateGame from '@/components/game/modules/invest-donate';
import BettingRpsGame from '@/components/game/modules/betting-rps';
import MultipleBnwGame from '@/components/game/modules/multiple-bnw';
import WinningStreakGame from '@/components/game/modules/winning-streak';
import BNW2Game from '@/components/game/modules/bnw2';
import SilperBnwGame from '@/components/game/modules/silper-bnw';
import GameModulePlaceholder from '@/components/game/GameModulePlaceholder';
import { useRoom } from '@/hooks/useRoom';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { GAME_IDS } from '@/shared/types';

const GAME_MODULES: Record<string, ComponentType> = {
  [GAME_IDS.FOUR_GRAVITY]: FourGravityGame,
  [GAME_IDS.DOUBLE_SIDED_CHESS]: DoubleSidedChessGame,
  [GAME_IDS.NUMBER_FOUR]: NumberFourGame,
  [GAME_IDS.INDIAN_POKER]: IndianPokerGame,
  [GAME_IDS.INVEST_DONATE]: InvestDonateGame,
  [GAME_IDS.BETTING_RPS]: BettingRpsGame,
  [GAME_IDS.MULTIPLE_BNW]: MultipleBnwGame,
  [GAME_IDS.WINNING_STREAK]: WinningStreakGame,
  [GAME_IDS.BNW2]: BNW2Game,
  [GAME_IDS.SILPER_BNW]: SilperBnwGame,
};

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const { gameResult } = useRoom(roomId);
  const gameId = useRoomStore((s) => s.room?.gameId);

  /** 플레이 라우트 진입마다(대기실→플레이는 roomId 동일) 이전 판 gameResult 제거 */
  useEffect(() => {
    useRoomStore.getState().setGameResult(null);
  }, []);

  useEffect(() => {
    if (!gameResult) return;
    const timer = setTimeout(() => {
      router.push(`/room/${roomId}/result`);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gameResult, roomId, router]);

  useEffect(() => {
    const socket = getSocket();
    const handleDisbanded = (data: { reason: string }) => {
      toast.info(data.reason);
      router.push('/');
    };
    socket.on('room:disbanded', handleDisbanded);
    return () => { socket.off('room:disbanded', handleDisbanded); };
  }, [router]);

  useEffect(() => {
    getSocket().emit('game:sync');
  }, [roomId]);

  return (
    <GameShell>
      {(() => {
        const GameModule = gameId ? GAME_MODULES[gameId] : null;
        return GameModule ? <GameModule /> : <GameModulePlaceholder />;
      })()}
    </GameShell>
  );
}
