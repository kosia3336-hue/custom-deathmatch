'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 데스크톱 우측 정보와 모바일 메모가 공유하는 짙은 정보 파츠. */
export function GameInfoStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3', className)}>{children}</div>;
}

export function GameInfoPart({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'ink-scope rounded-cdm-lg border border-cdm-ink-border bg-cdm-ink p-3 text-cdm-ink-fg shadow-sm',
        className,
      )}
    >
      {title != null && (
        <div className="mb-2 text-xs font-semibold tracking-wide text-cdm-ink-fg-muted">{title}</div>
      )}
      {children}
    </section>
  );
}
