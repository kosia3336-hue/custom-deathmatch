import { cn } from '@/lib/utils';

interface ProgressBarProps {
  current: number;
  max: number;
  className?: string;
}

export default function ProgressBar({ current, max, className }: ProgressBarProps) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const isFull = current >= max;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs font-medium text-cdm-fg-muted tabular-nums">
        {current}/{max}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cdm-bg-elev-2">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isFull ? 'bg-cdm-accent' : 'bg-cdm-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
