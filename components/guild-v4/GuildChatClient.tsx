'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/cdm/Button';
import { GuildMark } from '@/components/cdm/GuildMark';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { ChatMessage } from '@/shared/types';
import type { GuildRole } from '@/lib/guild/types';
import { getSocket } from '@/lib/socket';
import { useGuildChatStore } from '@/stores/guildChat';
import { useGuildDevStore } from './store';

/** 대시보드가 열려 있는 동안 길드 채팅 히스토리·실시간 메시지를 받는다. */
export function GuildChatSync({
  enabled,
  memberId,
  guildId,
}: {
  enabled: boolean;
  memberId: string;
  guildId: string;
}) {
  useEffect(() => {
    if (!enabled || !memberId || !guildId) {
      useGuildChatStore.getState().clearAll();
      return;
    }
    useGuildChatStore.getState().bindSeenScope(memberId, guildId);
    const s = getSocket();
    const onHistory = (payload: { messages: ChatMessage[] }) => {
      useGuildChatStore.getState().setHistory(payload.messages);
    };
    const onMessage = (msg: ChatMessage) => {
      if (msg.scope !== 'guild') return;
      useGuildChatStore.getState().addMessage(msg);
    };
    const onConnect = () => {
      if (!useGuildChatStore.getState().historyLoaded) s.emit('guild:chat:load');
    };
    s.on('guild:chat:history', onHistory);
    s.on('chat:message', onMessage);
    s.on('connect', onConnect);
    if (!useGuildChatStore.getState().historyLoaded) s.emit('guild:chat:load');
    return () => {
      s.off('guild:chat:history', onHistory);
      s.off('chat:message', onMessage);
      s.off('connect', onConnect);
      useGuildChatStore.getState().clearAll();
    };
  }, [enabled, memberId, guildId]);
  return null;
}

/**
 * 내 길드 대시보드에서 여는 채팅 창.
 * 말풍선 UI는 더미와 같고, 메시지는 운영 길드 채팅 소켓을 쓴다.
 */
export function GuildChatModal({
  open,
  onClose,
  guildName,
  markUrl,
}: {
  open: boolean;
  onClose: () => void;
  guildName: string | null;
  markUrl: string | null;
}) {
  const messages = useGuildChatStore((s) => s.messages);
  const chatLastSeen = useGuildChatStore((s) => s.lastSeenMsgCount);
  const clearChatUnread = useGuildChatStore((s) => s.clearChatUnread);
  const nickname = useGuildDevStore((s) => s.meNickname);
  const members = useGuildDevStore((s) => s.my.members);
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottomRef = useRef(true);
  const openedJumpRef = useRef(false);
  /** 열 때 한 번만 찍는다. 읽음 처리 전에 안 읽은 시작점 */
  const unreadFromRef = useRef<number | null>(null);

  if (open) {
    if (unreadFromRef.current === null) unreadFromRef.current = chatLastSeen;
  } else if (unreadFromRef.current !== null) {
    unreadFromRef.current = null;
    openedJumpRef.current = false;
  }
  const unreadFrom = unreadFromRef.current;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    clearChatUnread();
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearChatUnread();
      clearTimeout(t);
    };
  }, [open, onClose, clearChatUnread]);

  useEffect(() => {
    if (!open) return;
    clearChatUnread();
  }, [open, messages.length, clearChatUnread]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;

    if (!openedJumpRef.current) {
      openedJumpRef.current = true;
      const anchor = unreadAnchorRef.current;
      if (anchor && unreadFrom != null && unreadFrom < messages.length) {
        const top = anchor.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
        el.scrollTop = Math.max(0, top - 8);
        stickToBottomRef.current = false;
        return;
      }
      el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = true;
      return;
    }

    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [open, messages, unreadFrom]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || !nickname) return;
    getSocket().emit('chat:send', { message: trimmed, scope: 'guild' });
    setInput('');
    stickToBottomRef.current = true;
  };

  if (!open || !mounted) return null;

  const title = guildName ? `${guildName} 채팅방` : '길드 채팅방';

  return createPortal(
    <div className="guild-dev-chat-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="guild-dev-chat-backdrop" onClick={onClose} aria-hidden />
      <div className="guild-dev-chat-panel">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-cdm-ink-border bg-cdm-ink px-4 py-3">
          <GuildMark
            mark={markUrl ? { url: markUrl, name: guildName } : null}
            size="lg"
            className="h-8 w-8 rounded-cdm-md"
          />
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-cdm-ink-fg">{title}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="rounded-cdm-md p-1 text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-cdm-bg-elev-1 px-3 py-3"
        >
          {messages.length === 0 ? (
            <p className="py-16 text-center text-xs text-cdm-fg-subtle">
              아직 메시지가 없습니다.
              <br />
              길드원에게 첫 인사를 보내 보세요.
            </p>
          ) : (
            messages.map((m, i) => (
              <div key={m.id}>
                {unreadFrom != null && unreadFrom < messages.length && i === unreadFrom && (
                  <div
                    ref={unreadAnchorRef}
                    className="mb-3 flex items-center gap-2 py-1"
                    role="separator"
                    aria-label="안 읽은 메시지"
                  >
                    <span className="h-px min-w-0 flex-1 bg-cdm-accent/40" />
                    <span className="shrink-0 text-[10px] font-semibold tracking-wide text-cdm-accent">
                      안 읽은 메시지
                    </span>
                    <span className="h-px min-w-0 flex-1 bg-cdm-accent/40" />
                  </div>
                )}
                <GuildChatLine
                  m={m}
                  myNickname={nickname}
                  role={
                    members.find((x) => x.memberId === m.sender)?.role ??
                    members.find((x) => x.nickname === m.senderNickname)?.role ??
                    null
                  }
                />
              </div>
            ))
          )}
        </div>

        <form
          className="flex shrink-0 gap-2 border-t border-cdm-border bg-cdm-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2 text-sm outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지 입력..."
            maxLength={200}
            aria-label="길드 채팅 입력"
          />
          <Button size="sm" type="submit" disabled={!input.trim()} className="shrink-0">
            전송
          </Button>
        </form>
      </div>

      <style>{`
        .guild-dev-chat-overlay {
          position: fixed;
          inset: 0;
          z-index: var(--cdm-z-modal);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .guild-dev-chat-backdrop {
          position: absolute;
          inset: 0;
          background: rgb(0 0 0 / 0.4);
        }
        .guild-dev-chat-panel {
          position: relative;
          display: flex;
          width: 100%;
          height: calc(100dvh - 3rem);
          flex-direction: column;
          overflow: hidden;
          background: var(--cdm-bg);
          border-radius: var(--cdm-radius-xl) var(--cdm-radius-xl) 0 0;
          box-shadow: var(--cdm-shadow-lg);
        }
        @media (min-width: 640px) {
          .guild-dev-chat-overlay {
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .guild-dev-chat-panel {
            flex: 0 0 auto;
            width: min(32rem, calc(100vw - 4rem));
            max-width: 32rem;
            height: min(36rem, calc(100dvh - 8rem));
            border: 1px solid var(--cdm-ink-border);
            border-radius: var(--cdm-radius-xl);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .guild-dev-chat-panel {
            animation: none;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function formatStamp(ts: number) {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(-2);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yy}.${mo}.${dd}`, time: `${hh}:${mm}` };
}

function GuildChatRoleMark({ role }: { role: GuildRole | null }) {
  if (role !== 'owner' && role !== 'vice_owner') return null;
  return (
    <span
      className={cn(
        'inline-flex h-4 shrink-0 items-center rounded-full px-1.5 text-[10px] font-bold leading-none text-white',
        role === 'owner' ? 'bg-cdm-primary' : 'bg-cdm-accent',
      )}
    >
      {role === 'owner' ? '길드장' : '부길드장'}
    </span>
  );
}

function GuildChatLine({
  m,
  myNickname,
  role,
}: {
  m: ChatMessage;
  myNickname: string | null;
  role: GuildRole | null;
}) {
  if (m.isSystem) {
    return (
      <p className="px-2 text-center text-[11px] text-cdm-fg-subtle">
        {m.message}
      </p>
    );
  }

  const isMe = m.senderNickname === myNickname;
  const title = m.senderTitle;
  const stamp = formatStamp(m.timestamp);

  return (
    <div className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
      {!isMe && (
        <div className="flex max-w-[85%] items-center gap-1 px-1">
          {title && (
            <TitleBadge
              name={title.name}
              color={title.color as TitleColor}
              effect={title.effect as TitleEffect | null}
              size="sm"
            />
          )}
          <GuildChatRoleMark role={role} />
          <span className="text-[11px] font-semibold leading-none text-cdm-fg-muted">
            {m.senderNickname}
          </span>
        </div>
      )}
      <div className={cn('flex max-w-[85%] items-end gap-1.5', isMe && 'flex-row-reverse')}>
        <p
          className={cn(
            'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isMe
              ? 'rounded-br-md bg-cdm-primary text-white'
              : 'rounded-bl-md border border-cdm-border bg-cdm-bg text-cdm-fg',
          )}
        >
          {m.message}
        </p>
        <span
          className={cn(
            'mb-0.5 shrink-0 text-[9px] leading-tight tabular-nums text-cdm-fg-subtle',
            isMe ? 'text-right' : 'text-left',
          )}
        >
          <span className="block">{stamp.date}</span>
          <span className="block">{stamp.time}</span>
        </span>
      </div>
    </div>
  );
}
