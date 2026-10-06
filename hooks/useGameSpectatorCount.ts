'use client';

import { useRoomStore } from '@/stores/room';
import { useEventRoomStore } from '@/stores/eventRoom';
import { useSmsEventRoomStore } from '@/stores/smsEventRoom';
import { useGuildWarStore } from '@/stores/guildWar';
import { GAME_IDS } from '@/shared/types/game';

/** 이벤트방도 기존 서버의 실시간 관전자 집계를 사용한다. */
export function useGameSpectatorCount(): number {
  const gameId = useRoomStore((s) => s.room?.gameId);
  const regular = useRoomStore((s) => s.room?.spectators.length ?? 0);
  const poker = useEventRoomStore((s) => s.state?.spectatorCount ?? 0);
  const sms = useSmsEventRoomStore((s) => s.state?.spectatorCount ?? 0);
  const war = useGuildWarStore((s) => s.state?.spectatorCount ?? 0);
  if (gameId === GAME_IDS.INDIAN_POKER_EVENT) return poker;
  if (gameId === GAME_IDS.SUN_MOON_STAR_EVENT) return sms;
  if (gameId === GAME_IDS.RING_THE_BELL) return war;
  return regular;
}
