import * as React from 'react';
import Image from 'next/image';
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
        <Image
          src="/brand/logo3.webp"
          alt=""
          aria-hidden
          width={96}
          height={69}
          className="h-auto w-24 opacity-80"
        />
      )}
      <p className="font-semibold text-cdm-fg">{title}</p>
      {description && <p className="text-sm text-cdm-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
