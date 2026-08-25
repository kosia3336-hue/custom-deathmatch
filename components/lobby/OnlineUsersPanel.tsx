'use client';

import { useEffect } from 'react';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { mailboxUnreadCount, useMailboxStore } from '@/stores/mailbox';

/**
 * GNB 버튼.
 * 클릭 시 글로벌 LobbyChatPanel(루트 SocketProvider 마운트)을 연다.
 * 채팅·우편 미읽음이 있으면 우상단에 빨간 배지를 표시한다.
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
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
