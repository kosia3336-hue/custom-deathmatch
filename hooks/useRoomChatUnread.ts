'use client';

import { useRoomStore } from '@/stores/room';

/** 열려 있는 방 채팅은 읽은 상태로 표시한다. */
export function useRoomChatUnread(open: boolean): number {
  const messagesLen = useRoomStore((s) => s.messages.length);
  const lastSeen = useRoomStore((s) => s.lastSeenMsgCount);
  return open ? 0 : Math.max(0, messagesLen - lastSeen);
}
