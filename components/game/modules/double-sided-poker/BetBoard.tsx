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
    <div className="border-cdm-border-strong -mx-1.5 grid grid-cols-2 border-y">
      {ordered.map((lane, index) => {
        const picked = selection === lane.side || selection === 'both';
        return (
          <div
            key={lane.side}
            className={cn(
              'flex items-baseline justify-between gap-1 px-3 py-2',
              // 가운데 칸막이 한 줄만 둔다. 바깥 테두리는 판 전체가 갖는다.
              index === 0 && 'border-cdm-border-strong border-r',
              picked ? 'bg-cdm-highlight-soft' : 'bg-cdm-bg',
            )}
          >
            <span
              className={cn(
                'text-[11px] font-black',
                picked ? 'text-cdm-highlight' : 'text-cdm-fg-muted',
              )}
            >
              {lane.label}
            </span>
            <span className="text-cdm-fg text-xl leading-6 font-black tabular-nums">
              {lane.amount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
