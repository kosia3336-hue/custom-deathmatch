import { cn } from '@/lib/utils';
import type { KingmakingStack } from '@/shared/types/kingmaking';

export function StackVisual({
  stack,
  playerIds,
  compact = false,
}: {
  stack: KingmakingStack;
  playerIds: string[];
  compact?: boolean;
}) {
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      {stack.map((piece, index) => {
        const first = piece.ownerId === playerIds[0];
        return (
          <span
            key={piece.id}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 border shadow-sm',
              first ? 'border-indigo-700 bg-indigo-500' : 'border-amber-700 bg-amber-400',
              piece.kind === 'special'
                ? 'rounded-t-full rounded-b-[30%] ring-1 ring-white/70'
                : 'rounded-full',
            )}
            style={{
              bottom: `${10 + index * (compact ? 10 : 11)}%`,
              width: compact ? '62%' : '68%',
              height: compact ? '15%' : '17%',
              zIndex: index + 1,
            }}
          >
            {piece.kind === 'special' && (
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white sm:text-[10px]">
                ◆
              </span>
            )}
          </span>
        );
      })}
      {stack.length > 0 && (
        <span className="bg-cdm-fg absolute top-1 right-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white tabular-nums">
          {stack.length}
        </span>
      )}
    </div>
  );
}
