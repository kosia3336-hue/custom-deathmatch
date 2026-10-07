'use client';

import { useEffect, type ReactNode } from 'react';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';

/** 점수/메모는 별도 창. 상단 바는 판·단계 정보만 갱신한다. */
export function useGameHud(hud: { round?: ReactNode; order?: ReactNode } | null) {
  const { setHud } = useRoomLayout();
  const round = hud?.round;
  const order = hud?.order;
  useEffect(() => {
    setHud(round != null || order != null ? { round, order, memo: null } : null);
    return () => setHud(null);
  }, [setHud, round, order]);
}
