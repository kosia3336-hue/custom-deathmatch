'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface RoomLayoutContextValue {
  setHeaderRight: (content: ReactNode) => void;
  setFooter: (content: ReactNode) => void;
}

export const RoomLayoutContext = createContext<RoomLayoutContextValue | null>(null);

export function useRoomLayout() {
  const ctx = useContext(RoomLayoutContext);
  if (!ctx) throw new Error('useRoomLayout must be used within RoomLayout');
  return ctx;
}
