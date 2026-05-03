import { cn } from '@/lib/utils';
import type { TurnPosition } from '@/lib/supabase/database.types';

interface TurnBadgeProps {
  turn: TurnPosition;
  size?: 'sm' | 'md';
  iconOnly?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: 'px-1.5 py-[2px] text-[11px]',
  md: 'px-2.5 py-[3px] text-xs',
};

/**
 * 선/후공 라벨. 색맹 대응을 위해 텍스트 + 아이콘 동반.
 *
 * docs/v2/15_common_ui.md §15.9.3
 */
export function TurnBadge({ turn, size = 'md', iconOnly = false, className }: TurnBadgeProps) {
  const isFirst = turn === 'first';
  const label = isFirst ? '선공' : '후공';
  const icon = isFirst ? '▶' : '▷';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold leading-none text-white whitespace-nowrap',
        isFirst ? 'bg-cdm-primary' : 'bg-cdm-accent',
        SIZE_CLASS[size],
        className,
      )}
      aria-label={label}
    >
      <span aria-hidden>{icon}</span>
      {!iconOnly && <span>{label}</span>}
    </span>
  );
}
