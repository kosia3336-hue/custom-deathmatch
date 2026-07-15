'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 외부 탭으로 닫기 허용 (기본 true). 확인 모달 등에서는 false */
  closeOnBackdrop?: boolean;
  /** ESC 닫기 (기본 true) */
  closeOnEscape?: boolean;
  /** 모바일에서 풀스크린/바텀시트 처리 (기본 true) */
  mobileBottomSheet?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
};

/**
 * 모달 / 모바일 바텀시트.
 * docs/v2/15_common_ui.md §15.3
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
  mobileBottomSheet = true,
  size = 'md',
  className,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open || !closeOnEscape) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center sm:items-center"
    >
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={() => closeOnBackdrop && onClose?.()}
        aria-hidden
      />
      <div
        className={cn(
          'relative w-full overflow-hidden bg-cdm-bg shadow-[var(--cdm-shadow-lg)]',
          mobileBottomSheet
            ? 'rounded-t-cdm-xl sm:rounded-cdm-xl'
            : 'rounded-cdm-xl mx-4',
          SIZE[size],
          'animate-[modal-in_200ms_var(--cdm-ease-out)]',
          className,
        )}
      >
        {(title || onClose) && (
          <header className="flex items-center justify-between gap-3 border-b border-cdm-ink-border bg-cdm-ink px-5 py-4">
            <h2 className="text-base font-semibold text-cdm-ink-fg">{title}</h2>
            {onClose && (
              <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className="rounded-cdm-md p-1 text-cdm-ink-fg-muted hover:text-white hover:bg-white/10"
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
            )}
          </header>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-cdm-border px-5 py-4">
            {footer}
          </footer>
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
