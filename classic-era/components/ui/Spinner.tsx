import { cn } from '@/classic-era/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-12 w-12' };

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn('animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600', sizes[size], className)}
      role="status"
    >
      <span className="sr-only">로딩 중...</span>
    </div>
  );
}
