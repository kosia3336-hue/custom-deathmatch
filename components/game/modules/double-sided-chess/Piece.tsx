'use client';

import type { PieceType, Owner } from '@/shared/types/double-sided-chess';
import type { SkinTheme } from '@/lib/skins/registry';
import { getPieceLabel, OWNER_COLOR } from './constants';
import { cn } from '@/lib/utils';

interface Props {
  piece: PieceType;
  owner: Owner;
  isPromoted: boolean;
  size?: 'sm' | 'md';
  skin?: SkinTheme | null;
}

/* 정오각형: first = 꼭짓점 위, second = 꼭짓점 아래 */
const CLIP_FIRST  = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
const CLIP_SECOND = 'polygon(50% 100%, 100% 62%, 82% 0%, 18% 0%, 0% 62%)';

export default function Piece({ piece, owner, isPromoted, size = 'md', skin }: Props) {
  const label = getPieceLabel(piece, isPromoted);
  const colors = OWNER_COLOR[owner];
  const clip = owner === 'first' ? CLIP_FIRST : CLIP_SECOND;
  const showPromotedRing = isPromoted && piece !== 'king';
  const isImperial = skin === 'imperial';

  const imperialClasses = isImperial && [
    'skin-imperial-piece',
    owner === 'first' ? 'skin-imperial-piece-first' : 'skin-imperial-piece-second',
    showPromotedRing && 'skin-imperial-piece-promoted',
  ];

  if (size === 'sm') {
    return (
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center font-bold text-xs select-none lg:h-10 lg:w-10 lg:text-sm',
          isImperial ? imperialClasses : [colors.bg, colors.text, showPromotedRing && 'ring-2 ring-amber-400'],
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
      style={{ zIndex: 3 }}
    >
      <div
        className={cn(
          'flex h-full w-full items-center justify-center font-bold text-sm',
          isImperial ? imperialClasses : [colors.bg, colors.text, showPromotedRing && 'ring-2 ring-amber-400'],
        )}
        style={{ clipPath: clip }}
      >
        {label}
      </div>
    </div>
  );
}
