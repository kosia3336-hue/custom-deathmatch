import { cn } from '@/lib/utils';
import type { TitleColor } from '@/lib/supabase/database.types';

export type TitleEffect = 'legend' | 'xuanwu' | 'baekho';

const EFFECT_CLASS: Record<TitleEffect, string> = {
  legend: 'title-legend',
  xuanwu: 'title-xuanwu',
  baekho: 'title-baekho',
};

interface TitleBadgeProps {
  name: string;
  color: TitleColor;
  effect?: TitleEffect | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'px-[7px] py-[1px] text-[11px]',
  md: 'px-[9px] py-[2px] text-xs',
  lg: 'px-[11px] py-1 text-sm',
};

/**
 * 칭호 뱃지. 아웃라인(테두리+글자 동색, 배경 투명) 스타일.
 * effect 지정 시 해당 테마 shimmer 애니메이션 적용.
 *
 * docs/v2/15_common_ui.md §15.9.2
 */
export function TitleBadge({ name, color, effect, size = 'md', className }: TitleBadgeProps) {
  const effectClass = effect ? EFFECT_CLASS[effect] : null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
        SIZE_CLASS[size],
        effectClass,
        className,
      )}
      style={effectClass ? undefined : {
        borderColor: `var(--title-${color})`,
        color: `var(--title-${color})`,
      }}
    >
      {name}
    </span>
  );
}
