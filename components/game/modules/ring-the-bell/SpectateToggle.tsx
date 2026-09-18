'use client';

import { cn } from '@/lib/utils';

/** 잉크 상단 바 오른쪽(채팅 옆). 어두운 헤더에서 노란 채움으로 구분한다. */
export function SpectateHeaderButton({
  label,
  onClick,
  reserved = false,
}: {
  label: string;
  onClick: () => void;
  reserved?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-cdm-md px-3 py-1.5 text-xs font-black whitespace-nowrap transition-colors',
        reserved
          ? 'bg-white text-cdm-ink hover:bg-cdm-highlight'
          : 'bg-cdm-highlight text-cdm-ink hover:bg-cdm-highlight-strong',
      )}
    >
      {label}
    </button>
  );
}
