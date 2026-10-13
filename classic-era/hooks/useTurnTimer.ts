'use client';

import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '@/classic-era/stores/room';

export function useTurnTimer() {
  const gameState = useRoomStore((s) => s.gameState);
  const room = useRoomStore((s) => s.room);

  const timeLimitSeconds = room?.timeLimitSeconds ?? null;
  const turnStartedAt = gameState?.turnStartedAt ?? null;

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
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      const left = Math.max(0, timeLimitSeconds - elapsed);
      setRemaining(left);

      if (left <= 10 && !isHighResRef.current) {
        isHighResRef.current = true;
        clearInterval(intervalRef.current!);
        intervalRef.current = setInterval(update, 100);
      }
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeLimitSeconds, turnStartedAt]);

  return { remaining, timeLimitSeconds };
}
