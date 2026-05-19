'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface RoomLayoutContextValue {
  setHeaderRight: (content: ReactNode) => void;
  setFooter: (content: ReactNode) => void;
  /** true면 sticky 푸터 바를 렌더하지 않음 (모달과 겹침·클릭 가로채기 방지) */
  setFooterHidden: (hidden: boolean) => void;
}

export const RoomLayoutContext = createContext<RoomLayoutContextValue | null>(null);

export function useRoomLayout() {
  const ctx = useContext(RoomLayoutContext);
  if (!ctx) throw new Error('useRoomLayout must be used within RoomLayout');
  return ctx;
}
