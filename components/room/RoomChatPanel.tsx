'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon, UnreadBadge } from '@/components/cdm';
import { RoomChatTabs, useRoomChatUnread } from '@/components/room/ChatButton';
import { setRoomChatDock, type RoomChatDock } from '@/lib/roomChatDock';
import { useRoomStore } from '@/stores/room';
import { cn } from '@/lib/utils';
import type { ChatScope } from '@/shared/types';

const svg = (d: ReactNode) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    {d}
  </svg>
);

const DOCK_OPTIONS: { value: RoomChatDock; label: string; icon: ReactNode }[] = [
  {
    value: 'right',
    label: '오른쪽에 붙이기',
    icon: svg(
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M15 4v16" />
      </>,
    ),
  },
  {
    value: 'bottom',
    label: '아래에 붙이기',
    icon: svg(
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 15h18" />
      </>,
    ),
  },
  { value: 'collapsed', label: '접기', icon: svg(<path d="M5 12h14" />) },
];

/** 채팅 판을 붙일 자리 고르기. 누르면 기기에 기억된다. */
export function RoomChatDockButtons({ dock }: { dock: RoomChatDock }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="채팅 위치">
      {DOCK_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setRoomChatDock(o.value)}
          aria-pressed={dock === o.value}
          aria-label={o.label}
          title={o.label}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-cdm-md transition-colors',
            dock === o.value
              ? 'bg-cdm-primary-soft text-cdm-primary'
              : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-2 hover:text-cdm-fg',
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

/**
 * 넓은 화면에 펴 두는 채팅 판(오른쪽 또는 아래). 머리에서 붙일 자리를 고른다.
 * 펴 둔 채팅은 늘 보고 있으므로 새 메시지는 바로 읽은 것으로 친다.
 */
export function RoomChatPanel({
  scope,
  dock,
  className,
}: {
  scope: ChatScope;
  dock: RoomChatDock;
  className?: string;
}) {
  const messagesLen = useRoomStore((s) => s.messages.length);
  const clearChatUnread = useRoomStore((s) => s.clearChatUnread);
  useEffect(() => {
    clearChatUnread();
  }, [messagesLen, clearChatUnread]);

  return (
    <section
      aria-label="채팅"
      className={cn(
        'flex flex-col overflow-hidden rounded-cdm-lg border border-cdm-border bg-cdm-bg',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-cdm-border px-3 py-1.5">
        <span className="flex-1 text-sm font-semibold text-cdm-fg">채팅</span>
        <RoomChatDockButtons dock={dock} />
      </div>
      <RoomChatTabs scope={scope} active />
    </section>
  );
}

/**
 * 채팅 한 줄 — 좁은 화면, 또는 넓은 화면에서 접어 뒀을 때.
 * 마지막 메시지와 안 읽은 수를 보여 주고, 누르면 채팅 시트를 연다.
 */
export function RoomChatBar({
  scope,
  sheetOpen,
  onOpen,
  className,
}: {
  scope: ChatScope;
  sheetOpen: boolean;
  onOpen: () => void;
  className?: string;
}) {
  const messages = useRoomStore((s) => s.messages);
  const unread = useRoomChatUnread(sheetOpen);

  let last = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].scope === scope || messages[i].scope === 'room') {
      last = messages[i];
      break;
    }
  }
  const preview = last
    ? `${last.isSystem ? '[시스템] ' : `${last.senderNickname}: `}${last.message}`
    : '채팅 열기';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="채팅 열기"
      className={cn(
        'flex items-center gap-2 rounded-cdm-lg border border-cdm-border-strong bg-cdm-bg px-3 py-2.5 text-sm shadow-(--cdm-shadow-md)',
        className,
      )}
    >
      <Icon name="chat" size="sm" />
      <span className="min-w-0 flex-1 truncate text-left text-cdm-fg-muted">{preview}</span>
      <UnreadBadge count={unread} label={`미읽음 ${unread}건`} />
      <svg className="h-4 w-4 shrink-0 text-cdm-fg-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
  );
}
