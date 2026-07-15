'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useLobbyChatStore, type LobbyChatTab } from '@/stores/lobbyChat';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { useNicknameStore } from '@/stores/nickname';
import { LobbyChatList } from './LobbyChatList';
import { LobbyChatInput } from './LobbyChatInput';
import type { OnlineUser } from '@/shared/types/events';

/** 상태별 컬러 점 (이모지 대체) */
const STATUS_DOT: Record<OnlineUser['status'], string> = {
  playing: 'bg-cdm-success',
  waiting: 'bg-cdm-highlight',
  lobby: 'bg-cdm-bg-elev-3',
};

function StatusDot({ status }: { status: OnlineUser['status'] }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />;
}

function UserRow({ user, isMe }: { user: OnlineUser; isMe: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-cdm-bg-elev-2 transition-colors">
      <span className={cn('min-w-0 truncate text-sm text-cdm-fg', isMe && 'font-bold')}>
        {user.nickname}
        {isMe && <span className="ml-1 text-cdm-fg-muted font-normal">(나)</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-cdm-fg-muted">
        <StatusDot status={user.status} />
      </span>
    </div>
  );
}

function OnlineUsersSummary({ users }: { users: OnlineUser[] }) {
  const playing = users.filter((u) => u.status === 'playing').length;
  const waiting = users.filter((u) => u.status === 'waiting').length;
  const lobby = users.filter((u) => u.status === 'lobby').length;

  return (
    <div className="flex items-center justify-around border-b border-cdm-border bg-cdm-bg-elev-1 px-2 py-3">
      <div className={cn('flex flex-col items-center gap-0.5', playing === 0 && 'opacity-40')}>
        <span className="flex items-center gap-1 text-sm"><StatusDot status="playing" /> {playing}</span>
        <span className="text-[10px] text-cdm-fg-muted">게임 중</span>
      </div>
      <span className="text-cdm-border">·</span>
      <div className={cn('flex flex-col items-center gap-0.5', waiting === 0 && 'opacity-40')}>
        <span className="flex items-center gap-1 text-sm"><StatusDot status="waiting" /> {waiting}</span>
        <span className="text-[10px] text-cdm-fg-muted">대기실</span>
      </div>
      <span className="text-cdm-border">·</span>
      <div className={cn('flex flex-col items-center gap-0.5', lobby === 0 && 'opacity-40')}>
        <span className="flex items-center gap-1 text-sm"><StatusDot status="lobby" /> {lobby}</span>
        <span className="text-[10px] text-cdm-fg-muted">로비</span>
      </div>
    </div>
  );
}

function OnlineUsersTabBody() {
  const users = useOnlineUsersStore((s) => s.users);
  const myNickname = useNicknameStore((s) => s.nickname);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <OnlineUsersSummary users={users} />
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <p className="py-12 text-center text-sm text-cdm-fg-muted">접속자 없음</p>
        ) : (
          users.map((user) => (
            <UserRow key={user.memberId} user={user} isMe={user.nickname === myNickname} />
          ))
        )}
      </div>
    </div>
  );
}

function TabButton({
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
        'relative flex h-11 flex-1 items-center justify-center gap-1.5 text-sm font-medium transition-colors',
        active ? 'text-cdm-fg' : 'text-cdm-fg-muted hover:text-cdm-fg',
      )}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-cdm-primary"
        />
      )}
    </button>
  );
}

/**
 * 로비 채팅 + 접속자 현황 통합 패널 (모달).
 * GNB 버튼이 여는 큰 모달.
 */
export function LobbyChatPanel() {
  const isOpen = useLobbyChatStore((s) => s.isOpen);
  const setOpen = useLobbyChatStore((s) => s.setOpen);
  const activeTab = useLobbyChatStore((s) => s.activeTab);
  const setActiveTab = useLobbyChatStore((s) => s.setActiveTab);
  const messagesLen = useLobbyChatStore((s) => s.messages.length);
  const usersLen = useOnlineUsersStore((s) => s.users.length);

  const inputRef = useRef<HTMLInputElement>(null);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setOpen]);

  // body 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // 채팅 탭 활성화 시 입력란 포커스
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'chat') return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const onTabChange = (tab: LobbyChatTab) => setActiveTab(tab);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="로비"
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center sm:items-center"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <div
        className={cn(
          'relative flex w-full flex-col overflow-hidden bg-cdm-bg shadow-(--cdm-shadow-lg)',
          // 모바일: 풀시트 (top-12로 GNB 노출)
          'h-[calc(100dvh-3rem)] rounded-t-cdm-xl',
          // 데스크탑: 중앙 카드
          'sm:h-[min(640px,calc(100vh-4rem))] sm:max-w-[560px] sm:rounded-cdm-xl',
          'animate-[modal-in_200ms_var(--cdm-ease-out)]',
        )}
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between border-b border-cdm-border px-5 py-3">
          <h2 className="text-base font-semibold text-cdm-fg">로비</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="rounded-cdm-md p-1 text-cdm-fg-muted hover:text-cdm-fg hover:bg-cdm-bg-elev-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* 탭바 */}
        <div className="flex border-b border-cdm-border" role="tablist">
          <TabButton active={activeTab === 'chat'} onClick={() => onTabChange('chat')}>
            <span>채팅</span>
            {messagesLen > 0 && (
              <span className="text-xs text-cdm-fg-muted">({messagesLen})</span>
            )}
          </TabButton>
          <TabButton active={activeTab === 'users'} onClick={() => onTabChange('users')}>
            <span>접속자</span>
            <span className="text-xs text-cdm-fg-muted">{usersLen}</span>
          </TabButton>
        </div>

        {/* 본문 */}
        {activeTab === 'chat' ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <LobbyChatList />
            <LobbyChatInput ref={inputRef} />
          </div>
        ) : (
          <OnlineUsersTabBody />
        )}
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
