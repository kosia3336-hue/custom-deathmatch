'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { getSocket } from '@/lib/socket';

type ErrorFeedback = { message?: string };
type WordSearchFeedback = { word: string; exists: boolean };
const socketFeedback = {
  subscribeError(handler: (data: ErrorFeedback) => void) {
    const socket = getSocket();
    socket.on('error', handler);
    return () => {
      socket.off('error', handler);
    };
  },
  subscribeWordSearch(handler: (data: WordSearchFeedback) => void) {
    const socket = getSocket();
    socket.on('wordpuzzle:searchResult', handler);
    return () => {
      socket.off('wordpuzzle:searchResult', handler);
    };
  },
};
const previewFeedback: typeof socketFeedback = {
  subscribeError: () => () => {},
  subscribeWordSearch: () => () => {},
};
const FeedbackContext = createContext(socketFeedback);
/** 로컬 미리보기는 소켓을 구독하지 않고 실제 화면만 사용한다. */
export function GameFeedbackProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <FeedbackContext.Provider value={enabled ? socketFeedback : previewFeedback}>
      {children}
    </FeedbackContext.Provider>
  );
}
export const useGameFeedback = () => useContext(FeedbackContext);
