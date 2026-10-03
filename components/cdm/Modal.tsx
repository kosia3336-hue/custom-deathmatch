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
  /** 오버레이 없이 그 자리에 패널만 그린다 (소개 미리보기 등) */
  inline?: boolean;
  /** 닫기 버튼. onClose 가 있으면 항상 표시, 없으면 장식용 */
  showClose?: boolean;
  /** 진행 중 닫기를 막을 때. onClose 가 있어도 X를 숨긴다. */
  hideClose?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** 룰 이미지처럼 패널 전체를 콘텐츠로 사용. 닫기는 이미지 위에 겹친다. */
  edgeToEdge?: boolean;
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-3xl',
};

/**
 * 모달 / 모바일 바텀시트.
 * docs/v2/15_common_ui.md §15.3
 */
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
  mobileBottomSheet = true,
  inline = false,
  showClose = false,
  hideClose = false,
  size = 'md',
  className,
  edgeToEdge = false,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const closeVisible = !hideClose && (Boolean(onClose) || showClose);

  React.useEffect(() => {
    if (inline || !open || !closeOnEscape) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, open, closeOnEscape, onClose]);

  React.useEffect(() => {
    if (inline || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [inline, open]);

  if (!open) return null;
  if (!inline && !mounted) return null;

  const panel = (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-cdm-bg shadow-[var(--cdm-shadow-lg)]',
        inline
          ? 'max-w-md rounded-cdm-xl'
          : mobileBottomSheet
            ? 'rounded-t-cdm-xl sm:rounded-cdm-xl'
            : 'rounded-cdm-xl mx-4',
        !inline && SIZE[size],
        !inline && 'animate-[modal-in_200ms_var(--cdm-ease-out)]',
        className,
      )}
    >
      {!edgeToEdge && (title || closeVisible) && (
        <header className="flex items-center justify-between gap-3 border-b border-cdm-ink-border bg-cdm-ink px-5 py-4">
          <h2 className="text-base font-semibold text-cdm-ink-fg">{title}</h2>
          {closeVisible && (
            onClose ? (
              <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className="rounded-cdm-md p-1 text-cdm-ink-fg-muted hover:text-white hover:bg-white/10"
              >
                <CloseIcon />
              </button>
            ) : (
              <span className="rounded-cdm-md p-1 text-cdm-ink-fg-muted" aria-hidden>
                <CloseIcon />
              </span>
            )
          )}
        </header>
      )}
      {edgeToEdge && onClose && (
        <button type="button" aria-label="닫기" onClick={onClose} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85"><CloseIcon /></button>
      )}
      <div className={edgeToEdge ? '' : 'px-5 py-4'}>{children}</div>
      {footer && (
        <footer className="flex justify-end gap-2 border-t border-cdm-border px-5 py-4">
          {footer}
        </footer>
      )}
    </div>
  );

  if (inline) return panel;

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
      {panel}
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
