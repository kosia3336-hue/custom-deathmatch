'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useLobbyChatStore, type LobbyChatTab } from '@/stores/lobbyChat';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { LobbyChatList } from './LobbyChatList';
import { LobbyChatInput } from './LobbyChatInput';
import { OnlineUsersList } from './OnlineUsersList';

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
          <OnlineUsersList />
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
