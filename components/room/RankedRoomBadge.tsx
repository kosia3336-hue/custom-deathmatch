import { cn } from '@/lib/utils';

/**
 * 랭크 게임 표시 — 예전 제목 앞 '[랭크]' 글자를 배지로 만든 것.
 * 방 제목 맨 앞에 두고, 모양은 시간 제한(타이머) 배지와 같은 크기·글자 크기를 쓴다.
 */
export default function RankedRoomBadge({ className }: { className?: string }) {
  return (
    <span
      title="랭크 게임"
      className={cn(
        'inline-flex shrink-0 items-center rounded-cdm-sm border border-cdm-primary/30 bg-cdm-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-cdm-primary',
        className,
      )}
    >
      랭크
    </span>
  );
}
