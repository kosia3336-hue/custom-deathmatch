import { GamePiece3D } from '@/components/game/abstract-strategy';
import type { KingmakingStack } from '@/shared/types/kingmaking';

export function StackVisual({
  stack,
  playerIds,
  compact = false,
  springRain = false,
}: {
  stack: KingmakingStack;
  playerIds: string[];
  compact?: boolean;
  springRain?: boolean;
}) {
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      {stack.map((piece, index) => {
        const first = piece.ownerId === playerIds[0];
        const special = piece.kind === 'special';
        return (
          <span
            key={piece.id}
            className={`kingmaking-stack-piece ${first ? 'kingmaking-stack-piece--first' : 'kingmaking-stack-piece--second'} ${special ? 'kingmaking-stack-piece--special' : 'kingmaking-stack-piece--normal'} absolute left-1/2 -translate-x-1/2`}
            style={{
              bottom: `${8 + index * (compact ? 10.2 : 11.1)}%`,
              width: compact ? '66%' : '72%',
              height: special ? (compact ? '21%' : '23%') : compact ? '17%' : '19%',
              zIndex: index + 1,
            }}
          >
            <GamePiece3D
              tone={first ? 'primary' : 'highlight'}
              shape={special ? 'crown' : 'disc'}
              label={special ? '◆' : undefined}
              className={springRain ? 'kingmaking-spring-rain-piece' : undefined}
            />
            {springRain && special && (
              <span className="kingmaking-spring-rain-special-piece" />
            )}
          </span>
        );
      })}
      {stack.length > 0 && (
        <span className="kingmaking-stack-count bg-cdm-fg absolute top-1 right-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white tabular-nums">
          {stack.length}
        </span>
      )}
    </div>
  );
}
