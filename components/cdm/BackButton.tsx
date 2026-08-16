'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Props {
  label?: string;
  className?: string;
}

/** 브라우저 히스토리 뒤로가기 버튼. 히스토리가 없으면 홈으로. */
export function BackButton({ label = '뒤로가기', className }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push('/lobby');
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-cdm-md px-2 py-1.5 text-sm font-medium text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-1 hover:text-cdm-fg',
        className,
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
