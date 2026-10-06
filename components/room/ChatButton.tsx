'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, UnreadBadge } from '@/components/cdm';
import { useRoomStore } from '@/stores/room';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import type { ChatScope } from '@/shared/types';
import { useRoomChatChannels, RoomChatContent, RoomChatHeaderActions, RoomChatChannelTitle } from './RoomChatChannels';

/** 안 읽은 방 채팅 수. 셸이 톱니 위에 얹을 때도 쓴다. */
export function useRoomChatUnread(open: boolean): number {
  const messagesLen = useRoomStore((s) => s.messages.length);
  const lastSeenMsgCount = useRoomStore((s) => s.lastSeenMsgCount);
  return open ? 0 : Math.max(0, messagesLen - lastSeenMsgCount);
}

/**
 * 채팅 판. 아래에서 올라온다.
 *
 * 예전에는 화면 한가운데 뜨는 Modal 이었다. 같은 게임 안에서 베팅 입력은
 * 시트로 올라오고 채팅만 가운데 뜨니 문법이 둘로 갈렸다. 게임 화면에서
 * 손으로 하는 일은 전부 아래에서 올라오는 것으로 맞춘다 (BottomSheet 주석 참고).
 *
 * 여는 버튼과 판을 나눠 둔 것은, 게임 화면에서는 '설정' 안의 줄이 이 판을
 * 열고 대기실에서는 제 버튼이 열기 때문이다.
 */
export function RoomChatSheet({
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
  const channels = useRoomChatChannels();
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
      title="채팅"
      headerTitle={<RoomChatChannelTitle channels={channels} />}
      bodyClassName="px-0"
      headerRight={<RoomChatHeaderActions channels={channels} />}
    >
      <div className="flex h-[52dvh] flex-col">
        <RoomChatContent scope={scope} active={open} channels={channels} />
      </div>
    </BottomSheet>
  );
}

/** 대기실 등에서 쓰는 채팅 진입 버튼. 게임 화면은 '설정' 안에서 연다. */
export default function ChatButton({ scope }: { scope: ChatScope }) {
  const [open, setOpen] = useState(false);
  const unreadCount = useRoomChatUnread(open);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:bg-cdm-bg-elev-1 relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors md:px-3"
        title="채팅"
      >
        <Icon name="chat" size="sm" />
        <span className="hidden text-sm font-medium md:inline">채팅</span>
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
