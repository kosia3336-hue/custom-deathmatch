import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** 빈 상태 — 마이페이지/랭킹/로비 등에서 사용. (15번 §15.13) */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10 px-6 text-center',
        className,
      )}
    >
      {icon ?? (
        <span aria-hidden className="inline-flex items-end gap-[3px] opacity-60">
          <span className="block h-6 w-[6px] rounded-[2px] bg-cdm-primary" />
          <span className="block h-6 w-[6px] rounded-[2px] bg-cdm-accent" />
        </span>
      )}
      <p className="font-semibold text-cdm-fg">{title}</p>
      {description && <p className="text-sm text-cdm-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
