'use client';
import { GamePiece3D } from '@/components/game/abstract-strategy';
import { cn } from '@/lib/utils';
import { ESKIMO_BEAR } from '@/shared/types/eskimo';

/** 칸 하나에 놓인 말. 선은 primary, 후는 highlight, 북극곰은 흰 말 위 곰 얼굴. */
export function EskimoPiece({
  piece,
  firstPlayerId,
  ghost = false,
  className,
}: {
  piece: string;
  firstPlayerId: string;
  ghost?: boolean;
  className?: string;
}) {
  const bear = piece === ESKIMO_BEAR;
  return (
    <span
      className={cn(
        'pointer-events-none absolute top-1/2 left-1/2 block h-[66%] w-[66%] -translate-x-1/2 -translate-y-1/2',
        ghost && 'opacity-50',
        className,
      )}
      aria-hidden
    >
      <GamePiece3D
        tone={bear ? 'light' : piece === firstPlayerId ? 'primary' : 'highlight'}
        shape={bear ? 'crown' : 'disc'}
      />
      {bear && (
        <span className="absolute inset-0 flex -translate-y-[8%] items-center justify-center text-[clamp(0.9rem,5.5vw,2rem)] leading-none">
          🐻‍❄️
        </span>
      )}
    </span>
  );
}

export function EskimoMarker({ tone }: { tone: 'primary' | 'highlight' | 'bear' }) {
  if (tone === 'bear') return <span className="text-sm leading-none">🐻‍❄️</span>;
  return (
    <span className="block h-3.5 w-3.5 shrink-0">
      <GamePiece3D tone={tone} />
    </span>
  );
}
