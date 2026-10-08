'use client';
import { cn } from '@/lib/utils';
import type { DoubleSidedPokerSelection } from '@/shared/types/double-sided-poker';

export function BetBoard({
  frontBet,
  backBet,
  selection,
}: {
  frontBet: number;
  backBet: number;
  selection: DoubleSidedPokerSelection;
}) {
  const ordered = [
    { side: 'front' as const, label: '앞면', amount: frontBet },
    { side: 'back' as const, label: '뒷면', amount: backBet },
  ];
  return (
    <div aria-label="면별 베팅 칩" className="grid grid-cols-2 gap-2">
      {ordered.map((lane) => {
        const picked = selection === lane.side || selection === 'both';
        return (
          <div
            key={lane.side}
            className={cn(
              'flex min-w-0 items-baseline justify-between gap-2 rounded-lg border px-3 py-2',
              picked ? 'border-cdm-primary bg-cdm-primary-soft' : 'border-cdm-border bg-cdm-bg',
            )}
          >
            <span
              className={cn(
                'text-[11px] font-black',
                picked ? 'text-cdm-primary' : 'text-cdm-fg-muted',
              )}
            >
              {lane.label}
            </span>
            <span className="text-cdm-fg text-2xl leading-7 font-black tabular-nums">
              {lane.amount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
