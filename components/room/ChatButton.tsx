'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, UnreadBadge } from '@/components/cdm';
import { useRoomStore } from '@/stores/room';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { useRoomChatUnread } from '@/hooks/useRoomChatUnread';
import type { ChatScope } from '@/shared/types';
import {
  useWaitingRoomChatChannels,
  WaitingRoomChatContent,
  WaitingRoomChatActions,
  WaitingRoomChatTitle,
} from './WaitingRoomChatChannels';

/** 대기실 채팅 시트. 이곳에서만 로비 채널로 전환할 수 있다. */
function RoomChatSheet({
  open,
  onClose,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  scope: ChatScope;
}) {
  /*
    닫힐 때 읽은 시점 기록 (방 채팅 기준).

    '열린 적 있는지' 를 따지는 것은, 이 컴포넌트가 대기실에서 닫힌 채로 늘
    붙어 있기 때문이다. 그냥 !open 으로 지우면 방에 들어서자마자 안 읽은
    채팅이 읽은 것으로 처리돼 배지가 사라진다.
  */
  const channels = useWaitingRoomChatChannels();
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) useRoomStore.getState().clearChatUnread();
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="방 채팅"
      headerTitle={<WaitingRoomChatTitle channels={channels} />}
      bodyClassName="px-0"
      headerRight={<WaitingRoomChatActions channels={channels} />}
    >
      <div className="flex h-[52dvh] flex-col">
        <WaitingRoomChatContent scope={scope} active={open} channels={channels} />
      </div>
    </BottomSheet>
  );
}

/** 대기실의 모바일 채팅 진입 버튼. */
export default function ChatButton({ scope }: { scope: ChatScope }) {
  const [open, setOpen] = useState(false);
  const unreadCount = useRoomChatUnread(open);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors md:px-3"
        aria-label="방 채팅"
        title="방 채팅"
      >
        <Icon name="chat" />
        <span className="text-[11px] leading-none font-medium">방 채팅</span>
        <UnreadBadge
          count={unreadCount}
          label={`미읽음 ${unreadCount}건`}
          className="absolute -top-1 -right-1"
        />
      </button>

      <RoomChatSheet open={open} onClose={() => setOpen(false)} scope={scope} />
    </>
  );
}
