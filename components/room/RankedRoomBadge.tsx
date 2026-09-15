import { Icon } from '@/components/cdm/Icon';
import { cn } from '@/lib/utils';

/** 랭크 게임 표시 — 방 제목 옆 비밀방(자물쇠)·시간 제한(타이머) 배지와 같은 자리·크기. 예전 제목 앞 '[랭크]' 대신. */
export default function RankedRoomBadge({ className }: { className?: string }) {
  return (
    <span
      aria-label="랭크 게임"
      title="랭크 게임"
      className={cn(
        'inline-flex shrink-0 items-center rounded-cdm-sm border border-cdm-primary/30 bg-cdm-primary-soft px-1.5 py-0.5 text-cdm-primary',
        className,
      )}
    >
      <Icon name="rank" size="sm" className="h-3.5 w-3.5" />
    </span>
  );
}
