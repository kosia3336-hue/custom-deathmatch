'use client';

import { useLobbyChatStore } from '@/stores/lobbyChat';

/**
 * GNB 버튼.
 * 클릭 시 글로벌 LobbyChatPanel(루트 SocketProvider 마운트)을 연다.
 * 미읽음 메시지가 있으면 우상단에 빨간 배지를 표시한다.
 */
export function OnlineUsersModalButton() {
  const setOpen = useLobbyChatStore((s) => s.setOpen);
  const isOpen = useLobbyChatStore((s) => s.isOpen);
  const messagesLen = useLobbyChatStore((s) => s.messages.length);
  const lastSeenMsgCount = useLobbyChatStore((s) => s.lastSeenMsgCount);
  const unreadCount = isOpen ? 0 : Math.max(0, messagesLen - lastSeenMsgCount);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-cdm-md text-cdm-ink-fg-muted transition-colors hover:bg-white/10 hover:text-white"
      aria-label="로비 채팅 / 접속자 현황"
      title="로비 채팅 / 접속자 현황"
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
