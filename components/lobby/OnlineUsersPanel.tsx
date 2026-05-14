'use client';

import { useLobbyChatStore } from '@/stores/lobbyChat';

/**
 * GNB 💬 버튼.
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
      className="relative rounded-cdm-md px-2 py-2 text-cdm-fg-muted hover:text-cdm-fg hover:bg-cdm-bg-elev-1 transition-colors"
      aria-label="로비 채팅 / 접속자 현황"
    >
      💬
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
