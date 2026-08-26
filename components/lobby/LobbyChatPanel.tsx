'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useLobbyChatStore, type LobbyChatTab } from '@/stores/lobbyChat';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { useNicknameStore } from '@/stores/nickname';
import { LobbyChatList } from './LobbyChatList';
import { LobbyChatInput } from './LobbyChatInput';
import { OnlineUsersList } from './OnlineUsersList';
import { MailboxPanel } from './MailboxPanel';
import { mailboxUnreadCount, useMailboxStore } from '@/stores/mailbox';

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'relative flex h-11 flex-1 items-center justify-center gap-1.5 text-sm font-medium transition-colors max-sm:min-w-0 max-sm:px-1',
        active ? 'text-cdm-fg' : 'text-cdm-fg-muted hover:text-cdm-fg',
      )}
    >
      {children}
      {typeof badge === 'number' && badge > 0 && (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cdm-primary px-1 text-[10px] font-bold leading-none text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
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
 * 로비 패널. 채팅·우편함은 전원. 접속자 탭만 천하.
 */
export function LobbyChatPanel() {
  const isOpen = useLobbyChatStore((s) => s.isOpen);
  const setOpen = useLobbyChatStore((s) => s.setOpen);
  const activeTab = useLobbyChatStore((s) => s.activeTab);
  const setActiveTab = useLobbyChatStore((s) => s.setActiveTab);
  const onlineCount = useOnlineUsersStore((s) => s.count);
  const myNickname = useNicknameStore((s) => s.nickname);
  const canSeeUsers = myNickname === '천하';
  const mailItems = useMailboxStore((s) => s.items);
  const mailUnread = mailboxUnreadCount(mailItems);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) return;
    useMailboxStore.getState().setFocusId(null);
  }, [isOpen]);

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

  useEffect(() => {
    if (!isOpen) return;
    void useMailboxStore.getState().refresh();
  }, [isOpen]);

  useEffect(() => {
    if (!canSeeUsers && activeTab === 'users') setActiveTab('chat');
  }, [canSeeUsers, activeTab, setActiveTab]);

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
          'h-[calc(100dvh-3.5rem)] min-h-0 rounded-t-cdm-xl pb-[env(safe-area-inset-bottom)]',
          'sm:h-[min(640px,calc(100vh-4rem))] sm:max-w-[560px] sm:rounded-cdm-xl sm:pb-0',
          'animate-[modal-in_200ms_var(--cdm-ease-out)]',
        )}
      >
        {/* 헤더 — 다른 모달과 같은 어두운 헤더 */}
        <header className="flex items-center justify-between border-b border-cdm-ink-border bg-cdm-ink px-5 py-4">
          <h2 className="text-lg font-bold text-cdm-ink-fg">로비</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="rounded-cdm-md p-1 text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white"
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

        <div className="flex border-b border-cdm-border" role="tablist">
          <TabButton active={activeTab === 'chat'} onClick={() => onTabChange('chat')}>
            <span className="max-sm:truncate">채팅({onlineCount}명)</span>
          </TabButton>
          <TabButton
            active={activeTab === 'mailbox'}
            onClick={() => onTabChange('mailbox')}
            badge={mailUnread}
          >
            <span>우편함</span>
          </TabButton>
          {canSeeUsers && (
            <TabButton active={activeTab === 'users'} onClick={() => onTabChange('users')}>
              <span>접속자</span>
            </TabButton>
          )}
        </div>

        {canSeeUsers && activeTab === 'users' ? (
          <OnlineUsersList />
        ) : activeTab === 'mailbox' ? (
          <div className="flex flex-1 flex-col overflow-hidden max-sm:min-h-0">
            <MailboxPanel />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden max-sm:min-h-0">
            <LobbyChatList />
            <LobbyChatInput ref={inputRef} />
          </div>
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
