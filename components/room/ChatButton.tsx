'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, UnreadBadge } from '@/components/cdm';
import { useRoomStore } from '@/stores/room';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { useNicknameStore } from '@/stores/nickname';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { RoomChatBody } from '@/components/room/RoomChat';
import { LobbyChatList } from '@/components/lobby/LobbyChatList';
import { LobbyChatInput } from '@/components/lobby/LobbyChatInput';
import { OnlineUsersList } from '@/components/lobby/OnlineUsersList';
import { cn } from '@/lib/utils';
import type { ChatScope } from '@/shared/types';

type RoomChatTab = 'users' | 'room' | 'lobby';

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
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) useRoomStore.getState().clearChatUnread();
  }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} title="채팅" bodyClassName="px-0">
      <div className="flex h-[52dvh] flex-col">
        <RoomChatTabs scope={scope} active={open} />
      </div>
    </BottomSheet>
  );
}

/**
 * 채팅 탭(접속자 · 방 채팅 · 로비 채팅)과 본문. 시트와 대기실에 펴 두는 채팅 판이 함께 쓴다.
 * 부모가 세로 flex 여야 본문이 남은 높이를 채운다. active 는 로비 탭 입력란 자동 포커스 조건.
 */
export function RoomChatTabs({ scope, active }: { scope: ChatScope; active: boolean }) {
  const [tab, setTab] = useState<RoomChatTab>('room');
  const onlineCount = useOnlineUsersStore((s) => s.count);
  const canSeeUsers = useNicknameStore((s) => s.nickname) === '천하';
  const lobbyInputRef = useRef<HTMLInputElement>(null);

  // 접속자 탭을 볼 수 없게 되면 방 채팅으로. effect 로 미루면 한 프레임 동안 빈 탭이 보인다.
  if (!canSeeUsers && tab === 'users') setTab('room');

  // 로비 채팅 탭 활성화 시 입력란 포커스
  useEffect(() => {
    if (!active || tab !== 'lobby') return;
    const t = setTimeout(() => lobbyInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [active, tab]);

  return (
    <>
      <div className="flex shrink-0 border-b border-cdm-border" role="tablist">
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'users' && <OnlineUsersList />}
        {tab === 'room' && (
          <RoomChatBody scope={scope} scrollClassName="flex-1 min-h-0 max-h-none" />
        )}
        {tab === 'lobby' && (
          <>
            <LobbyChatList />
            <LobbyChatInput ref={lobbyInputRef} />
          </>
        )}
      </div>
    </>
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
        className="relative flex items-center gap-1.5 rounded-lg border border-cdm-border bg-cdm-bg px-2 py-1.5 text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-1 md:px-3"
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
        <span aria-hidden className="absolute right-0 bottom-0 left-0 h-0.5 bg-cdm-primary" />
      )}
    </button>
  );
}
