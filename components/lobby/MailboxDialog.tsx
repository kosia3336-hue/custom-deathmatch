'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/cdm';
import { cn } from '@/lib/utils';
import { mailboxUnreadCount, useMailboxStore } from '@/stores/mailbox';
import { MailboxPanel } from './MailboxPanel';

/**
 * 우편함 모달. 채팅 패널과 분리해 봉투 아이콘으로 연다.
 *
 * 공지·칭호·길드·보상이 모두 여기로 모이므로 안 읽은 알림의 단일 창구다.
 * 채팅은 성격이 달라(실시간·비영구) 따로 둔다.
 */
export function MailboxDialog() {
  const isOpen = useMailboxStore((s) => s.isOpen);
  const setOpen = useMailboxStore((s) => s.setOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="우편함"
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center sm:items-center"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />

      <div
        className={cn(
          'bg-cdm-bg relative flex w-full flex-col overflow-hidden shadow-(--cdm-shadow-lg)',
          'rounded-t-cdm-xl h-[calc(100dvh-3.5rem)] min-h-0 pb-[env(safe-area-inset-bottom)]',
          'sm:rounded-cdm-xl sm:h-[min(640px,calc(100vh-4rem))] sm:max-w-[560px] sm:pb-0',
        )}
      >
        <header className="border-cdm-ink-border bg-cdm-ink flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-cdm-ink-fg text-lg font-bold">우편함</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="rounded-cdm-md text-cdm-ink-fg-muted p-1 hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MailboxPanel />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * GNB 봉투 버튼. 로그인한 사람에게만 보인다.
 * 배지는 안 읽은 편지 전체(공지 포함)를 센다 — 공지 메뉴의 별도 배지는 걷어냈다.
 */
export function MailboxModalButton() {
  const setOpen = useMailboxStore((s) => s.setOpen);
  const isOpen = useMailboxStore((s) => s.isOpen);
  const items = useMailboxStore((s) => s.items);
  const unread = isOpen ? 0 : mailboxUnreadCount(items);

  useEffect(() => {
    useMailboxStore.getState().hydrate();
  }, []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-cdm-md text-cdm-ink-fg-muted relative inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-white/10 hover:text-white"
      aria-label={unread > 0 ? `우편함, 안 읽은 편지 ${unread}통` : '우편함'}
      title={unread > 0 ? `안 읽은 편지 ${unread}통` : '우편함'}
    >
      <Icon name="mail" />
      {unread > 0 && (
        <span className="bg-cdm-primary absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
