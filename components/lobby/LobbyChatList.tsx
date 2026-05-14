'use client';

import { useEffect, useRef, useState } from 'react';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useNicknameStore } from '@/stores/nickname';
import { ChatBubble } from '@/components/room/RoomChat';
import { ReportModal } from '@/components/cdm/ReportModal';

const EMPTY_SPECTATORS: { id: string }[] = [];

/**
 * 로비 채팅 메시지 리스트 (스크롤 영역).
 * 기존 RoomChat의 ChatBubble 을 그대로 재사용한다.
 */
export function LobbyChatList() {
  const messages = useLobbyChatStore((s) => s.messages);
  const nickname = useNicknameStore((s) => s.nickname);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [reportTarget, setReportTarget] = useState<{
    memberId: string;
    nickname: string;
  } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 32;
  };

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-xs text-cdm-fg-subtle">
            아직 메시지가 없습니다. 첫 메시지를 보내보세요.
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

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.memberId ?? null}
        targetNickname={reportTarget?.nickname}
        context="chat"
      />
    </>
  );
}
