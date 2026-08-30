'use client';

import { useEffect } from 'react';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { mailboxUnreadCount, useMailboxStore } from '@/stores/mailbox';
import { Icon } from '@/components/cdm';

/**
 * GNB 버튼.
 * 클릭 시 글로벌 LobbyChatPanel(루트 SocketProvider 마운트)을 연다.
 * 채팅·우편 미읽음이 있으면 우상단에 배지를 표시한다.
 */
export function OnlineUsersModalButton() {
  const setOpen = useLobbyChatStore((s) => s.setOpen);
  const setActiveTab = useLobbyChatStore((s) => s.setActiveTab);
  const isOpen = useLobbyChatStore((s) => s.isOpen);
  const messagesLen = useLobbyChatStore((s) => s.messages.length);
  const lastSeenMsgCount = useLobbyChatStore((s) => s.lastSeenMsgCount);
  const mailItems = useMailboxStore((s) => s.items);
  const chatUnread = Math.max(0, messagesLen - lastSeenMsgCount);
  const mailUnread = mailboxUnreadCount(mailItems);
  const unreadCount = isOpen ? 0 : chatUnread + mailUnread;

  useEffect(() => {
    useMailboxStore.getState().hydrate();
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        setOpen(true);
        if (mailUnread > 0) setActiveTab('mailbox');
      }}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-cdm-md text-cdm-ink-fg-muted transition-colors hover:bg-white/10 hover:text-white"
      aria-label={
        mailUnread > 0
          ? `로비, 안 읽은 편지 ${mailUnread}통`
          : chatUnread > 0
            ? `로비, 안 읽은 채팅 ${chatUnread}`
            : '로비'
      }
      title={mailUnread > 0 ? `안 읽은 편지 ${mailUnread}통` : '로비'}
    >
      <Icon name="chat" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cdm-primary px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
