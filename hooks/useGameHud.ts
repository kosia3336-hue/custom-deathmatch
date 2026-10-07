'use client';

import { useEffect, type ReactNode } from 'react';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';

/** 상단 바의 판·단계 정보와 기록 같은 추가 아이콘을 갱신한다. */
export function useGameHud(
  hud: { round?: ReactNode; order?: ReactNode; headerAction?: ReactNode } | null,
) {
  const { setHud } = useRoomLayout();
  const round = hud?.round;
  const order = hud?.order;
  const headerAction = hud?.headerAction;
  useEffect(() => {
    setHud(
      round != null || order != null || headerAction != null
        ? { round, order, headerAction, memo: null }
        : null,
    );
    return () => setHud(null);
  }, [setHud, round, order, headerAction]);
}
