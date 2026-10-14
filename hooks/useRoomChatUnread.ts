'use client';

import { useRoomStore } from '@/stores/room';
import { useSpectatorNotifications } from './useSpectatorNotifications';
import { countsTowardChatBadge } from '@/lib/chatSettings';

/** 열려 있는 방 채팅은 읽은 상태로 표시한다. 관전자 입·퇴장 알림을 끄면 그 메시지는 배지에 세지 않는다. */
export function useRoomChatUnread(open: boolean): number {
  const messages = useRoomStore((s) => s.messages);
  const lastSeen = useRoomStore((s) => s.lastSeenMsgCount);
  const spectatorNotifications = useSpectatorNotifications();
  return open
    ? 0
    : messages.slice(lastSeen).filter((m) => countsTowardChatBadge(m, spectatorNotifications))
        .length;
}
