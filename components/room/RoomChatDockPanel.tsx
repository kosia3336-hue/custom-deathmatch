'use client';

import { useEffect } from 'react';
import DockablePanel from '@/components/cdm/DockablePanel';
import { useRoomChatChannels, RoomChatContent, RoomChatHeaderActions, RoomChatChannelTitle } from './RoomChatChannels';
import type { DockState } from '@/lib/dockPanel';
import { useRoomStore } from '@/stores/room';
import type { ChatScope } from '@/shared/types';

/** 대기실 채팅창 자리를 기억하는 id (lib/dockPanel.ts) */
export const ROOM_CHAT_DOCK_ID = 'room-chat';

const FLOATING_SIZE = { width: 320, height: 440 };

/**
 * 대기실 채팅창(넓은 화면). 끌어서 가장자리에 붙이거나 원하는 자리에 띄운다(공용 DockablePanel).
 * 좁은 화면에서는 부모가 숨기고(hidden md:flex) 헤더의 채팅 버튼 → 시트를 쓴다.
 */
export default function RoomChatDockPanel({
  scope,
  dock,
  className,
}: {
  scope: ChatScope;
  dock: DockState;
  className?: string;
}) {
  // 펴 둔 채팅은 늘 보고 있으므로 새 메시지는 바로 읽은 것으로. 좁은 화면(숨김)에서는 헤더 배지를 살려 둔다.
  const channels = useRoomChatChannels();
  const messagesLen = useRoomStore((s) => s.messages.length);
  const clearChatUnread = useRoomStore((s) => s.clearChatUnread);
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) clearChatUnread();
  }, [messagesLen, clearChatUnread]);

  return (
    <DockablePanel
      id={ROOM_CHAT_DOCK_ID}
      title="채팅"
      headerTitle={<RoomChatChannelTitle channels={channels} />}
      headerActions={<RoomChatHeaderActions channels={channels} />}
      dock={dock}
      floatingSize={FLOATING_SIZE}
      className={className}
    >
      <RoomChatContent scope={scope} active channels={channels} />
    </DockablePanel>
  );
}
