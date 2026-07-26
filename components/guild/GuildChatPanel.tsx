'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useGuildChatStore } from '@/stores/guildChat';
import { useNicknameStore } from '@/stores/nickname';
import { Button } from '@/components/cdm/Button';
import { ChatBubble } from '@/components/room/RoomChat';
import { ReportModal } from '@/components/cdm/ReportModal';
import type { ChatMessage } from '@/shared/types';

const EMPTY_SPECTATORS: { id: string }[] = [];

/**
 * 길드 채팅 — 길드원 전용. 채팅은 DB 에 영속되며 14일 지난 메시지는 서버에서 자동 정리된다.
 * 길드 페이지(MyGuildPanel)에서만 마운트되며, 진입 시 최근 50개를 로드한다.
 */
export function GuildChatPanel() {
  const messages = useGuildChatStore((s) => s.messages);
  const historyLoaded = useGuildChatStore((s) => s.historyLoaded);
  const nickname = useNicknameStore((s) => s.nickname);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(null);

  useEffect(() => {
    const s = getSocket();
    const onHistory = (payload: { messages: ChatMessage[] }) => {
      useGuildChatStore.getState().setHistory(payload.messages);
    };
    const onMessage = (msg: ChatMessage) => {
      if (msg.scope !== 'guild') return;
      useGuildChatStore.getState().addMessage(msg);
    };
    // 재연결 시(useSocket 이 전역적으로 store 를 초기화) 패널이 계속 열려 있어도
    // 히스토리를 다시 받아오도록 'connect' 에도 재요청한다.
    const onConnect = () => {
      if (!useGuildChatStore.getState().historyLoaded) s.emit('guild:chat:load');
    };
    s.on('guild:chat:history', onHistory);
    s.on('chat:message', onMessage);
    s.on('connect', onConnect);
    if (!historyLoaded) s.emit('guild:chat:load');
    return () => {
      s.off('guild:chat:history', onHistory);
      s.off('chat:message', onMessage);
      s.off('connect', onConnect);
    };
    // historyLoaded 는 최초 요청 여부 판단용이라 의존성에서 제외(재요청 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || !nickname) return;
    getSocket().emit('chat:send', { message: trimmed, scope: 'guild' });
    setInput('');
  };

  return (
    <div className="flex flex-col rounded-cdm-lg border border-cdm-border bg-cdm-bg">
      <div
        ref={scrollRef}
        className="min-h-[160px] max-h-[320px] flex-1 space-y-2 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-cdm-fg-subtle">
            아직 메시지가 없습니다. 길드원에게 인사해 보세요!
          </p>
        ) : (
          messages.map((m) => (
            <ChatBubble
              key={m.id}
              m={m}
              spectators={EMPTY_SPECTATORS}
              myNickname={nickname}
              onReport={setReportTarget}
            />
          ))
        )}
      </div>
      <div className="flex gap-2 border-t border-cdm-border p-3">
        <input
          className="flex-1 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm outline-none focus:border-cdm-primary placeholder:text-cdm-fg-subtle"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="길드원에게만 보여요..."
          maxLength={200}
        />
        <Button size="sm" onClick={send} className="shrink-0">
          전송
        </Button>
      </div>

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.memberId ?? null}
        targetNickname={reportTarget?.nickname}
        context="chat"
      />
    </div>
  );
}
