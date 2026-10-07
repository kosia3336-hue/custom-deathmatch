'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { getSocket } from '@/lib/socket';

export type GameActionSender = (action: Record<string, unknown>) => void;
const sendSocketAction: GameActionSender = (action) => getSocket().emit('game:action', action);
const GameActionContext = createContext<GameActionSender>(sendSocketAction);

/** View와 로컬 검증은 같은 조작 컴포넌트를 사용하고 전송 경로만 주입한다. */
export function GameActionProvider({
  send,
  children,
}: {
  send: GameActionSender;
  children: ReactNode;
}) {
  return <GameActionContext.Provider value={send}>{children}</GameActionContext.Provider>;
}
export const useGameAction = () => useContext(GameActionContext);
