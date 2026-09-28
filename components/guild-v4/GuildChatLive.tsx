'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useGuildChatStore } from '@/stores/guildChat';
import type { ChatMessage } from '@/shared/types';

let listenersOn = false;
let liveGuildId: string | null = null;

function attachGuildChatListeners(): void {
  if (listenersOn) return;
  listenersOn = true;
  const s = getSocket();
  const onHistory = (payload: { messages: ChatMessage[] }) => {
    if (!liveGuildId) return;
    useGuildChatStore.getState().setHistory(payload.messages);
  };
  const onMessage = (msg: ChatMessage) => {
    if (!liveGuildId || msg.scope !== 'guild') return;
    useGuildChatStore.getState().addMessage(msg);
  };
  const requestHistory = () => {
    if (!liveGuildId) return;
    s.emit('guild:chat:load');
  };
  s.on('guild:chat:history', onHistory);
  s.on('chat:message', onMessage);
  s.on('connect', requestHistory);
  s.on('session:restored', requestHistory);
}

/** 길드가 없으면 수신을 멈추고 목록을 비운다. 있으면 읽음 위치를 맞추고 히스토리를 받는다. */
export function syncGuildChatLive(
  input: { memberId: string; guildId: string | null; seenMessageId: string | null } | null,
): void {
  if (!input?.guildId) {
    liveGuildId = null;
    useGuildChatStore.getState().clearAll();
    return;
  }
  const switched = liveGuildId !== null && liveGuildId !== input.guildId;
  liveGuildId = input.guildId;
  if (switched) useGuildChatStore.getState().clearAll();
  const store = useGuildChatStore.getState();
  store.bindSeenScope(input.memberId, input.guildId);
  store.setSeenMessageId(input.seenMessageId);
  attachGuildChatListeners();
  if (!useGuildChatStore.getState().historyLoaded) getSocket().emit('guild:chat:load');
}

export function useGuildChatUnread(): number {
  const len = useGuildChatStore((s) => s.messages.length);
  const seen = useGuildChatStore((s) => s.lastSeenMsgCount);
  return Math.max(0, len - seen);
}

/** 로그인 동안 길드 채팅을 받아 헤더 배지를 채운다. 루트에 한 번만 둔다. */
export function GuildChatLive() {
  const { member } = useCurrentMember();
  const memberId = member?.id ?? null;

  useEffect(() => {
    if (!memberId) {
      syncGuildChatLive(null);
      return;
    }
    let cancel = false;
    fetch('/api/guild2/chat-badge')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { guildId?: string | null; chatSeenMessageId?: string | null } | null) => {
        if (cancel || !j) return;
        syncGuildChatLive({
          memberId,
          guildId: j.guildId ?? null,
          seenMessageId: j.chatSeenMessageId ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [memberId]);

  return null;
}
