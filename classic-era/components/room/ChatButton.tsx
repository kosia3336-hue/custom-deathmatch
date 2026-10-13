'use client';

import { useState, useEffect } from 'react';
import { useRoomStore } from '@/classic-era/stores/room';
import Modal from '@/classic-era/components/ui/Modal';
import RoomChat from '@/classic-era/components/room/RoomChat';
import type { ChatScope } from '@/classic-era/shared/types';

interface Props {
  scope: ChatScope;
  scrollClassName?: string;
}

export default function ChatButton({ scope, scrollClassName }: Props) {
  const [showChat, setShowChat] = useState(false);
  const messagesLen = useRoomStore((s) => s.messages.length);
  const lastSeenMsgCount = useRoomStore((s) => s.lastSeenMsgCount);
  const unreadCount = showChat ? 0 : Math.max(0, messagesLen - lastSeenMsgCount);

  // 채팅 닫힐 때 읽은 시점 기록
  useEffect(() => {
    if (!showChat) {
      useRoomStore.getState().clearChatUnread();
    }
  }, [showChat]);

  const handleOpen = () => {
    setShowChat(true);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors md:px-3"
        title="채팅"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="hidden text-sm font-medium md:inline">채팅</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Modal
        open={showChat}
        onClose={() => setShowChat(false)}
        title="채팅"
        className="w-full max-w-sm md:max-w-lg"
      >
        <RoomChat scope={scope} scrollClassName={scrollClassName} />
      </Modal>
    </>
  );
}
