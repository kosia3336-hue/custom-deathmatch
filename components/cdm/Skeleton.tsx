import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED = {
  sm: 'rounded-cdm-sm',
  md: 'rounded-cdm-md',
  lg: 'rounded-cdm-lg',
  full: 'rounded-full',
};

/** 펄스 그라디언트 스켈레톤. (15번 §15.5) */
export function Skeleton({ className, width, height, rounded = 'md' }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'block animate-pulse bg-gradient-to-r from-cdm-bg-elev-1 via-cdm-bg-elev-2 to-cdm-bg-elev-1 bg-[length:200%_100%]',
        ROUNDED[rounded],
        className,
      )}
      style={{ width, height }}
    />
  );
}
