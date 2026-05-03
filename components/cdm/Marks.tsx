import { cn } from '@/lib/utils';

/** 👑 방장 마크 */
export function HostMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center text-cdm-highlight', className)}
      aria-label="방장"
      title="방장"
    >
      👑
    </span>
  );
}

/** 👁️ 관전자 마크 */
export function SpectatorMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center text-cdm-fg-muted', className)}
      aria-label="관전자"
      title="관전자"
    >
      👁️
    </span>
  );
}

/** "(나)" 자기 자신 라벨 */
export function MeLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn('text-cdm-fg-muted text-xs font-medium', className)}
      aria-label="나 자신"
    >
      (나)
    </span>
  );
}

/** ⚡ 재연결 중 마크 (옵션 카운트다운) */
export function ReconnectingMark({
  seconds,
  className,
}: {
  seconds?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-cdm-highlight text-xs font-medium', className)}
      aria-live="polite"
      aria-label={`재연결 중${typeof seconds === 'number' ? ` ${seconds}초 남음` : ''}`}
    >
      <span aria-hidden>⚡</span>
      <span>재연결 중{typeof seconds === 'number' ? ` ${seconds}s` : ''}</span>
    </span>
  );
}
