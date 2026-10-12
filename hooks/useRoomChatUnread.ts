'use client';

import { useRoomStore } from '@/stores/room';
import { useSpectatorNotifications } from './useSpectatorNotifications';
import { isChatMessageVisible } from '@/lib/chatSettings';

/** 열려 있는 방 채팅은 읽은 상태로 표시한다. */
export function useRoomChatUnread(open: boolean): number {
  const messages = useRoomStore((s) => s.messages);
  const lastSeen = useRoomStore((s) => s.lastSeenMsgCount);
  const spectatorNotifications = useSpectatorNotifications();
  return open
    ? 0
    : messages.slice(lastSeen).filter((m) => isChatMessageVisible(m, spectatorNotifications))
        .length;
}
