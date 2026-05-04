'use client';

import { useBgm } from '@/components/providers/BgmProvider';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

export function BgmButton({ className }: Props) {
  const { hasTracks, muted, toggle } = useBgm();

  if (!hasTracks) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? '배경음악 켜기' : '배경음악 끄기'}
      aria-pressed={!muted}
      title={muted ? '배경음악 켜기' : '배경음악 끄기'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-cdm-md text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-1 hover:text-cdm-fg sm:h-8 sm:w-8',
        className,
      )}
    >
      {muted ? <IconMuted /> : <IconOn />}
    </button>
  );
}

function IconOn() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function IconMuted() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
