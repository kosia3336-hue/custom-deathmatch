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
  /** 개발 미리보기에서는 네트워크 전송 대신 로컬 메시지를 추가한다. */
  onSend?: (message: string, scope: ChatScope) => void;
}

/**
 * v2 — 방/인게임 통합 채팅.
 *  - 칭호 캡슐 (보유자만)
 *  - 관전자 👁️ 마크
 *  - 시스템 메시지는 텍스트만
 */
export default function RoomChat({ scope, scrollClassName, onSend }: Props) {
  return (
    <div className="rounded-cdm-lg border-cdm-border bg-cdm-bg flex flex-col border">
      <RoomChatBody scope={scope} scrollClassName={scrollClassName} onSend={onSend} />
    </div>
  );
}

/** 공용 메시지·입력 본문. 대기실 채널창과 인게임 방 채팅에서 공유한다. */
export function RoomChatBody({ scope, scrollClassName, onSend }: Props) {
  const allMessages = useRoomStore((s) => s.messages);
  const messages = useMemo(() => {
    if (scope === 'guild_war') return allMessages.filter((m) => m.scope === 'guild_war');
    return allMessages.filter((m) => m.scope === 'room' || m.scope === 'game');
  }, [allMessages, scope]);
  const spectators = useRoomStore((s) => s.room?.spectators ?? EMPTY_SPECTATORS);
  const nickname = useNicknameStore((s) => s.nickname);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(
    null,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim() || (!onSend && !nickname)) return;
    if (onSend) onSend(input.trim(), scope);
    else getSocket().emit('chat:send', { message: input.trim(), scope });
    setInput('');
  };

  return (
    <>
      <div
        ref={scrollRef}
        className={cn(
          'max-h-[280px] min-h-[120px] flex-1 space-y-2 overflow-y-auto p-4',
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
          <p className="text-cdm-fg-subtle py-8 text-center text-xs">
            {scope === 'guild_war' ? '같은 길드만 보입니다' : '메시지가 없습니다'}
          </p>
        )}
      </div>
      <div className="border-cdm-border flex shrink-0 gap-2 border-t p-3">
        {/* iOS 는 16px 미만 입력칸에 포커스하면 화면을 확대한다 — 좁은 화면은 16px(text-base) */}
        <input
          className="rounded-cdm-md border-cdm-border bg-cdm-bg focus:border-cdm-primary placeholder:text-cdm-fg-subtle min-w-0 flex-1 border px-3 py-2 text-base md:text-sm outline-none"
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
        <span className="text-cdm-fg-subtle text-xs">[시스템] {m.message}</span>
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
          <TitleBadge
            name={title.name}
            color={title.color as TitleColor}
            effect={title.effect as TitleEffect | null}
            size="sm"
            className="mr-1.5"
          />
        )}
        {/* 길드 마크 아이콘은 길드 페이지에서만 표시(v2.2) — 채팅에서는 "닉네임 [길드명]" 텍스트로 표시 */}
        <span className="text-cdm-fg font-semibold">{m.senderNickname}</span>
        {m.senderGuildName && (
          <span className="text-cdm-fg-muted ml-1 text-xs font-medium">[{m.senderGuildName}]</span>
        )}
        <span className="text-cdm-fg-muted">: {m.message}</span>
        {canReport && (
          <button
            type="button"
            onClick={() => onReport({ memberId: m.senderMemberId!, nickname: m.senderNickname })}
            className="text-cdm-fg-subtle hover:text-cdm-danger ml-2 hidden text-xs underline-offset-2 group-hover:inline"
          >
            신고
          </button>
        )}
      </div>
    </div>
  );
}
