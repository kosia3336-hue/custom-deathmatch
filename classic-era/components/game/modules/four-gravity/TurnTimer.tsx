'use client';

import { cn } from '@/classic-era/lib/utils';

interface Props {
  remaining: number;
  compact?: boolean;
}

export default function TurnTimer({ remaining, compact }: Props) {
  const min = Math.floor(remaining / 60);
  const sec = Math.floor(remaining % 60);
  const display = remaining <= 10 && remaining > 0
    ? remaining.toFixed(1)
    : `${min}:${sec.toString().padStart(2, '0')}`;

  const isWarning = remaining <= 30 && remaining > 10;
  const isDanger = remaining <= 10 && remaining > 5;
  const isCritical = remaining <= 5;

  return (
    <span
      className={cn(
        'font-mono font-bold tabular-nums',
        compact ? 'text-xs' : 'text-sm',
        isWarning && 'text-amber-500',
        isDanger && 'text-red-500 animate-pulse',
        isCritical && 'text-red-600 animate-[pulse_0.5s_ease-in-out_infinite]',
        !isWarning && !isDanger && !isCritical && 'text-gray-600',
      )}
    >
      ⏱ {display}
    </span>
  );
}
