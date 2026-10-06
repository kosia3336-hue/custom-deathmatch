'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { cn } from '@/lib/utils';
import { Button } from '@/components/cdm/Button';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { SpectatorMark } from '@/components/cdm/Marks';
import { ReportModal } from '@/components/cdm/ReportModal';
import type { ChatScope, ChatMessage } from '@/shared/types';
import type { TitleColor } from '@/lib/supabase/database.types';

const EMPTY_SPECTATORS: { id: string }[] = [];

interface Props {
  scope: ChatScope;
  scrollClassName?: string;
}

/**
 * v2 — 방/인게임 통합 채팅.
 *  - 칭호 캡슐 (보유자만)
 *  - 관전자 👁️ 마크
 *  - 시스템 메시지는 텍스트만
 */
export default function RoomChat({ scope, scrollClassName }: Props) {
  return (
    <div className="flex flex-col rounded-cdm-lg border border-cdm-border bg-cdm-bg">
      <RoomChatBody scope={scope} scrollClassName={scrollClassName} />
    </div>
  );
}

/**
 * 테두리 없는 본문(메시지 목록 + 입력창)만 — 바깥에서 자체 탭 컨테이너로 감쌀 때(예: 방 채팅
 * 탭바가 있는 ChatButton) 이중 테두리를 피하려고 분리했다.
 */
export function RoomChatBody({ scope, scrollClassName }: Props) {
  const allMessages = useRoomStore((s) => s.messages);
  const messages = useMemo(() => {
    if (scope === 'guild_war') return allMessages.filter((m) => m.scope === 'guild_war');
    return allMessages.filter((m) => m.scope === 'room' || m.scope === 'game');
  }, [allMessages, scope]);
  const spectators = useRoomStore((s) => s.room?.spectators ?? EMPTY_SPECTATORS);
  const nickname = useNicknameStore((s) => s.nickname);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim() || !nickname) return;
    getSocket().emit('chat:send', { message: input.trim(), scope });
    setInput('');
  };

  return (
    <>
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto p-4 min-h-[120px] max-h-[280px]',
          scrollClassName,
        )}
      >
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            m={m}
            spectators={spectators}
            myNickname={nickname}
            onReport={setReportTarget}
          />
        ))}
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-cdm-fg-subtle">
            {scope === 'guild_war' ? '같은 길드만 보입니다' : '메시지가 없습니다'}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-cdm-border p-3">
        <input
          className="min-w-0 flex-1 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm outline-none focus:border-cdm-primary placeholder:text-cdm-fg-subtle"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={scope === 'guild_war' ? '같은 길드에게만 보입니다' : '메시지 입력...'}
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
    </>
  );
}

export function ChatBubble({
  m,
  spectators,
  myNickname,
  onReport,
}: {
  m: ChatMessage;
  spectators: { id: string }[];
  myNickname: string | null;
  onReport: (target: { memberId: string; nickname: string }) => void;
}) {
  if (m.isSystem) {
    return (
      <div className="text-sm">
        <span className="text-xs text-cdm-fg-subtle">[시스템] {m.message}</span>
      </div>
    );
  }

  const isSpec = m.isSpectator ?? spectators.some((s) => s.id === m.sender);
  const title = m.senderTitle;
  const isMe = m.senderNickname === myNickname;
  const canReport = !isMe && !!m.senderMemberId;

  return (
    <div className="group flex flex-col">
      <div className="text-sm">
        {isSpec && <SpectatorMark className="mr-1" />}
        {title && (
          <TitleBadge name={title.name} color={title.color as TitleColor} effect={title.effect as TitleEffect | null} size="sm" className="mr-1.5" />
        )}
        {/* 길드 마크 아이콘은 길드 페이지에서만 표시(v2.2) — 채팅에서는 "닉네임 [길드명]" 텍스트로 표시 */}
        <span className="font-semibold text-cdm-fg">{m.senderNickname}</span>
        {m.senderGuildName && (
          <span className="ml-1 text-xs font-medium text-cdm-fg-muted">[{m.senderGuildName}]</span>
        )}
        <span className="text-cdm-fg-muted">: {m.message}</span>
        {canReport && (
          <button
            type="button"
            onClick={() => onReport({ memberId: m.senderMemberId!, nickname: m.senderNickname })}
            className="ml-2 hidden text-xs text-cdm-fg-subtle underline-offset-2 hover:text-cdm-danger group-hover:inline"
          >
            신고
          </button>
        )}
      </div>
    </div>
  );
}
