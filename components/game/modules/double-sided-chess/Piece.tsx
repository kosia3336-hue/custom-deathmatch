'use client';

import type { PieceType, Owner } from '@/shared/types/double-sided-chess';
import { getPieceLabel, OWNER_COLOR } from './constants';
import { cn } from '@/lib/utils';

interface Props {
  piece: PieceType;
  owner: Owner;
  isPromoted: boolean;
  size?: 'sm' | 'md';
}

const CLIP_FIRST = 'polygon(15% 100%, 0% 30%, 50% 0%, 100% 30%, 85% 100%)';
const CLIP_SECOND = 'polygon(15% 0%, 0% 70%, 50% 100%, 100% 70%, 85% 0%)';

export default function Piece({ piece, owner, isPromoted, size = 'md' }: Props) {
  const label = getPieceLabel(piece, isPromoted);
  const colors = OWNER_COLOR[owner];
  const clip = owner === 'first' ? CLIP_FIRST : CLIP_SECOND;
  const showPromotedRing = isPromoted && piece !== 'king';

  if (size === 'sm') {
    return (
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center font-bold text-xs select-none lg:h-10 lg:w-10 lg:text-sm',
          colors.bg, colors.text,
          showPromotedRing && 'ring-2 ring-amber-400',
        )}
        style={{ clipPath: clip }}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-[7%] flex items-center justify-center select-none"
    >
      <div
        className={cn(
          'flex h-full w-full items-center justify-center font-bold text-sm',
          colors.bg, colors.text,
          showPromotedRing && 'ring-2 ring-amber-400',
        )}
        style={{ clipPath: clip }}
      >
        {label}
      </div>
    </div>
  );
}
