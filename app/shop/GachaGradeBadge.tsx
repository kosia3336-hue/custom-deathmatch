import { cn } from '@/lib/utils';
import type { GachaGrade } from '@/lib/gacha/types';

const STYLES: Record<GachaGrade, string> = {
  S: 'border-amber-400/50 bg-amber-400/15 text-amber-600 dark:text-amber-400',
  A: 'border-purple-400/50 bg-purple-400/15 text-purple-600 dark:text-purple-400',
  B: 'border-blue-400/50 bg-blue-400/15 text-blue-600 dark:text-blue-400',
  C: 'border-teal-400/50 bg-teal-400/15 text-teal-700 dark:text-teal-400',
  F: 'border-cdm-border bg-cdm-fg/10 text-cdm-fg-muted',
};

interface Props {
  grade: GachaGrade;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-px min-w-[1.5rem]',
  md: 'text-xs px-2 py-0.5 min-w-[1.75rem]',
  lg: 'text-sm px-3 py-1 min-w-[2.25rem]',
};

export default function GachaGradeBadge({ grade, size = 'sm', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-bold tabular-nums',
        STYLES[grade],
        SIZE[size],
        className,
      )}
    >
      {grade}
    </span>
  );
}
