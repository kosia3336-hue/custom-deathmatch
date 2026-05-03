import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'full' | 'mark' | 'mono';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: { mark: 'h-5', text: 'text-base', sub: 'text-[11px]' },
  md: { mark: 'h-6', text: 'text-lg', sub: 'text-[12px]' },
  lg: { mark: 'h-8', text: 'text-2xl', sub: 'text-sm' },
};

/**
 * Custom Deathmatch 워드마크.
 * 좌측 두 막대(▐▌) — 인디고 + 코랄 (1:1 결투의 상징).
 */
export function Logo({ variant = 'full', size = 'md', className }: LogoProps) {
  const s = SIZE[size];

  const mark = (
    <span
      className={cn('inline-flex items-end gap-[2px]', s.mark)}
      aria-hidden="true"
    >
      <span
        className={cn(
          'block w-[5px] rounded-[2px]',
          variant === 'mono' ? 'bg-cdm-fg' : 'bg-cdm-primary',
          s.mark,
        )}
      />
      <span
        className={cn(
          'block w-[5px] rounded-[2px]',
          variant === 'mono' ? 'bg-cdm-fg' : 'bg-cdm-accent',
          s.mark,
        )}
      />
    </span>
  );

  if (variant === 'mark') {
    return (
      <span className={cn('inline-flex items-center', className)} aria-label="Custom Deathmatch">
        {mark}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}
      aria-label="Custom Deathmatch"
    >
      {mark}
      <span className={cn('text-cdm-fg', s.text)}>Custom Deathmatch</span>
    </span>
  );
}
