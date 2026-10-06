'use client';

import { useTurnTimer } from '@/hooks/useTurnTimer';
import GameLoading from '@/components/game/GameLoading';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { getSkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import type { IndianPokerAction, IndianPokerGameData } from '@/shared/types/indian-poker';
import IndianPokerView from './IndianPokerView';

const sendAction = (action: IndianPokerAction) => getSocket().emit('game:action', action);

export default function IndianPokerGame() {
  const { remaining } = useTurnTimer();
  const state = useRoomStore((s) => s.gameState);
  const spectator = useRoomStore((s) => s.isSpectator);
  const myId = useMySocketId();
  const data = state?.gameData as IndianPokerGameData | undefined;
  return data ? (
    <IndianPokerView
      key={state?.startedAt}
      gameData={data}
      myId={myId}
      isSpectator={spectator}
      skin={getSkinTheme(state?.activeSkin, GAME_IDS.INDIAN_POKER)}
      remaining={remaining}
      onAction={sendAction}
    />
  ) : (
    <GameLoading label="게임을 불러오는 중" />
  );
}
