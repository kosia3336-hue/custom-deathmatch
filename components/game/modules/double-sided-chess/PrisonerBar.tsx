'use client';

import type { PieceType, Owner } from '@/shared/types/double-sided-chess';
import type { SkinTheme } from '@/lib/skins/registry';
import Piece from './Piece';
import { cn } from '@/lib/utils';

interface Props {
  prisoners: PieceType[];
  owner: Owner;
  isMine: boolean;
  isMyTurn: boolean;
  selectedPrisoner: PieceType | null;
  onSelect: (piece: PieceType) => void;
  winner: string | null;
  skin?: SkinTheme | null;
}

export default function PrisonerBar({
  prisoners,
  owner,
  isMine,
  isMyTurn,
  selectedPrisoner,
  onSelect,
  winner,
  skin,
}: Props) {
  const canInteract = isMine && isMyTurn && !winner;

  if (prisoners.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
        <span className="text-xs text-gray-400">포로 없음</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5">
      <span className="mr-1 text-xs text-gray-500">{isMine ? '내 포로' : '상대 포로'}:</span>
      {prisoners.map((piece, i) => {
        const isSelected = selectedPrisoner === piece && canInteract;
        return (
          <button
            key={`${piece}-${i}`}
            onClick={() => canInteract && onSelect(piece)}
            disabled={!canInteract}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md border transition-colors lg:h-12 lg:w-12',
              isSelected
                ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                : canInteract
                  ? 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  : 'cursor-default border-gray-100 bg-gray-50 opacity-60',
            )}
          >
            <Piece piece={piece} owner={owner} isPromoted={false} size="sm" skin={skin} />
          </button>
        );
      })}
    </div>
  );
}
