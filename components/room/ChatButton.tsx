'use client';

import { useState, useEffect, useRef } from 'react';
import { UnreadBadge } from '@/components/cdm';
import { useRoomStore } from '@/stores/room';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { useNicknameStore } from '@/stores/nickname';
import { Modal } from '@/components/cdm/Modal';
import { RoomChatBody } from '@/components/room/RoomChat';
import { LobbyChatList } from '@/components/lobby/LobbyChatList';
import { LobbyChatInput } from '@/components/lobby/LobbyChatInput';
import { OnlineUsersList } from '@/components/lobby/OnlineUsersList';
import { cn } from '@/lib/utils';
import type { ChatScope } from '@/shared/types';

type RoomChatTab = 'users' | 'room' | 'lobby';

interface Props {
  scope: ChatScope;
  scrollClassName?: string;
}

/**
 * 방/게임 화면 채팅 진입 버튼.
 * 방 채팅 / 로비 채팅. 접속자 탭은 천하만.
 */
export default function ChatButton({ scope, scrollClassName }: Props) {
  const [showChat, setShowChat] = useState(false);
  const [tab, setTab] = useState<RoomChatTab>('room');
  const messagesLen = useRoomStore((s) => s.messages.length);
  const lastSeenMsgCount = useRoomStore((s) => s.lastSeenMsgCount);
  const onlineCount = useOnlineUsersStore((s) => s.count);
  const canSeeUsers = useNicknameStore((s) => s.nickname) === '천하';
  const unreadCount = showChat ? 0 : Math.max(0, messagesLen - lastSeenMsgCount);

  const lobbyInputRef = useRef<HTMLInputElement>(null);

  // 채팅 닫힐 때 읽은 시점 기록 (방 채팅 기준)
  useEffect(() => {
    if (!showChat) {
      useRoomStore.getState().clearChatUnread();
    }
  }, [showChat]);

  useEffect(() => {
    if (!canSeeUsers && tab === 'users') setTab('room');
  }, [canSeeUsers, tab]);

  // 로비 채팅 탭 활성화 시 입력란 포커스
  useEffect(() => {
    if (!showChat || tab !== 'lobby') return;
    const t = setTimeout(() => lobbyInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [showChat, tab]);

  const handleOpen = () => {
    setShowChat(true);
  };

  const bodyHeightClass = scrollClassName ?? 'min-h-[240px] max-h-[340px]';

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
          <UnreadBadge
            count={unreadCount}
            label={`미읽음 ${unreadCount}건`}
            className="absolute -top-1 -right-1"
          />
        )}
      </button>

      <Modal
        open={showChat}
        onClose={() => setShowChat(false)}
        title="채팅"
        className="w-full max-w-sm md:max-w-lg"
      >
        <div className="flex flex-col overflow-hidden rounded-cdm-lg border border-cdm-border bg-cdm-bg">
          <div className="flex border-b border-cdm-border" role="tablist">
            {canSeeUsers && (
              <ChatTabButton active={tab === 'users'} onClick={() => setTab('users')}>
                접속자
              </ChatTabButton>
            )}
            <ChatTabButton active={tab === 'room'} onClick={() => setTab('room')}>
              방 채팅
            </ChatTabButton>
            <ChatTabButton active={tab === 'lobby'} onClick={() => setTab('lobby')}>
              로비 채팅({onlineCount}명)
            </ChatTabButton>
          </div>

          <div className={cn('flex flex-col overflow-hidden', bodyHeightClass)}>
            {tab === 'users' && <OnlineUsersList />}
            {tab === 'room' && <RoomChatBody scope={scope} scrollClassName="flex-1 min-h-0 max-h-none" />}
            {tab === 'lobby' && (
              <>
                <LobbyChatList />
                <LobbyChatInput ref={lobbyInputRef} />
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function ChatTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-10 flex-1 items-center justify-center gap-1 text-sm font-medium transition-colors',
        active ? 'text-cdm-fg' : 'text-cdm-fg-muted hover:text-cdm-fg',
      )}
    >
      {children}
      {active && (
        <span aria-hidden className="absolute bottom-0 left-0 right-0 h-0.5 bg-cdm-primary" />
      )}
    </button>
  );
}
