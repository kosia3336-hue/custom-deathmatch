'use client';

import { useCallback } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { getSkinTheme, type SkinTheme } from '@/lib/skins/registry';
import type { GameActionSender } from '@/components/game/GameActionContext';

export interface GameModuleViewProps<T> {
  gameData?: T;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}

/** 서버 연결만 담당한다. 경기 키 변경 시 View의 개인 입력/메모도 새 판으로 초기화한다. */
export function useGameModuleConnection<T>(gameId: string) {
  const gameState = useRoomStore((state) => state.gameState);
  const roomId = useRoomStore((state) => state.room?.id ?? '');
  const isSpectator = useRoomStore((state) => state.isSpectator);
  const myId = useMySocketId();
  const { remaining } = useTurnTimer();
  const sendAction = useCallback<GameActionSender>(
    (action) => {
      if (!isSpectator) getSocket().emit('game:action', action);
    },
    [isSpectator],
  );
  return {
    gameData: gameState?.gameData as T | undefined,
    myId,
    isSpectator,
    roomId,
    gameKey: `${roomId}:${gameState?.startedAt ?? ''}`,
    remaining,
    skin: getSkinTheme(gameState?.activeSkin, gameId),
    sendAction,
  };
}
