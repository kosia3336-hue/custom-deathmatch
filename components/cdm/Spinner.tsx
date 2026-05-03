import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 16 | 24 | 48;
  className?: string;
  label?: string;
}

export function Spinner({ size = 24, className, label = '로딩 중' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('inline-block animate-spin rounded-full border-current border-t-transparent', className)}
      style={{
        width: size,
        height: size,
        borderWidth: size >= 48 ? 4 : size >= 24 ? 3 : 2,
      }}
    />
  );
}
