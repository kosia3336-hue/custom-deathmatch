'use client';

import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { getGameClock } from '@/lib/gameProgress';
import { serverNow } from '@/lib/serverClock';
import { useEventRoomStore } from '@/stores/eventRoom';
import { useSmsEventRoomStore } from '@/stores/smsEventRoom';
import { GAME_IDS } from '@/shared/types/game';
import { IPE_TURN_TIME_LIMIT_SECONDS } from '@/shared/types/indian-poker-event';

export function useTurnTimer() {
  const gameState = useRoomStore((s) => s.gameState);
  const room = useRoomStore((s) => s.room);

  const eventStart = useEventRoomStore((s) => s.state?.gameData.turnStartedAt);
  const smsDeadline = useSmsEventRoomStore((s) => s.state?.gameData.pickDeadlineAt);
  let { timeLimitSeconds, turnStartedAt } = getGameClock(room?.gameId, gameState, room?.timeLimitSeconds ?? null);
  if (room?.gameId === GAME_IDS.INDIAN_POKER_EVENT) {
    timeLimitSeconds = IPE_TURN_TIME_LIMIT_SECONDS;
    turnStartedAt = eventStart ?? null;
  } else if (room?.gameId === GAME_IDS.SUN_MOON_STAR_EVENT) {
    // 절대 마감 시각을 동일 카운트다운 계약으로 변환한다.
    timeLimitSeconds = 1;
    turnStartedAt = smsDeadline == null ? null : smsDeadline - 1000;
  }

  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHighResRef = useRef(false);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    isHighResRef.current = false;

    if (timeLimitSeconds == null || turnStartedAt == null) {
      setRemaining(null);
      return;
    }

    const update = () => {
      // 서버가 찍은 시각과 비교하므로 기기 시계가 아니라 서버 기준 '지금' 을 쓴다
      const elapsed = (serverNow() - turnStartedAt) / 1000;
      const left = Math.max(0, timeLimitSeconds - elapsed);
      setRemaining(left);

      if (left <= 10 && !isHighResRef.current) {
        isHighResRef.current = true;
        clearInterval(intervalRef.current!);
        intervalRef.current = setInterval(update, 100);
      }
    };

    intervalRef.current = setInterval(update, 1000);
    // update가 마지막 10초용 interval로 교체한 뒤 덮어쓰지 않는다.
    update();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeLimitSeconds, turnStartedAt]);

  return {
    remaining,
    timeLimitSeconds,
    deadline: turnStartedAt == null || timeLimitSeconds == null ? null : turnStartedAt + timeLimitSeconds * 1000,
    clockKey: turnStartedAt == null || timeLimitSeconds == null ? null : `${room?.id}:${turnStartedAt}:${timeLimitSeconds}`,
  };
}
