'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  /** backdrop 클릭 시 onClose 대신 호출. 제공되지 않으면 onClose 사용 (closable일 때만) */
  onBackdropClick?: () => void;
  title?: string;
  closable?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ open, onClose, onBackdropClick, title, closable = true, children, className }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, closable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="fixed inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onBackdropClick ?? (closable ? onClose : undefined)}
          />
          <motion.div
            ref={contentRef}
            className={cn(
              'relative z-10 w-full max-w-md rounded-cdm-xl bg-cdm-bg shadow-(--cdm-shadow-lg) max-h-[90vh] overflow-y-auto',
              className,
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {(title || closable) && (
              <div className="flex items-center justify-between gap-3 border-b border-cdm-ink-border bg-cdm-ink px-6 py-4">
                {title && <h2 className="text-lg font-bold text-cdm-ink-fg">{title}</h2>}
                {closable && (
                  <button onClick={onClose} className="ml-auto rounded-cdm-md p-1 text-cdm-ink-fg-muted hover:text-white hover:bg-white/10">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
