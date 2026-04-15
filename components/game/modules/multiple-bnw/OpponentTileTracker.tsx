'use client';

import type { MBNWTile, MBNWTileColor } from '@/shared/types/multiple-bnw';
import { MBNW_TILE_SET, MBNW_TILE_COLOR } from '@/shared/types/multiple-bnw';

interface OpponentTileTrackerProps {
  markedTiles: MBNWTile[];
  onToggle: (tile: MBNWTile) => void;
  /** 이번 라운드 상대 타일 색 (hint 하이라이트용) */
  opponentCurrentColor?: MBNWTileColor | null;
}

export default function OpponentTileTracker({
  markedTiles,
  onToggle,
  opponentCurrentColor,
}: OpponentTileTrackerProps) {
  const whites = MBNW_TILE_SET.filter(t => MBNW_TILE_COLOR[t] === 'white');
  const blacks = MBNW_TILE_SET.filter(t => MBNW_TILE_COLOR[t] === 'black');

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-500">상대 타일 추리</p>

      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-[10px] text-gray-400">백색</p>
          <div className="flex flex-wrap gap-1.5">
            {whites.map(t => (
              <TrackerTile
                key={t}
                tile={t}
                color="white"
                marked={markedTiles.includes(t)}
                highlighted={opponentCurrentColor === 'white' && !markedTiles.includes(t)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] text-gray-400">흑색</p>
          <div className="flex flex-wrap gap-1.5">
            {blacks.map(t => (
              <TrackerTile
                key={t}
                tile={t}
                color="black"
                marked={markedTiles.includes(t)}
                highlighted={opponentCurrentColor === 'black' && !markedTiles.includes(t)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400">클릭하여 사용된 것으로 표시</p>
    </div>
  );
}

function TrackerTile({
  tile,
  color,
  marked,
  highlighted,
  onToggle,
}: {
  tile: MBNWTile;
  color: MBNWTileColor;
  marked: boolean;
  highlighted: boolean;
  onToggle: (tile: MBNWTile) => void;
}) {
  if (marked) {
    return (
      <button
        onClick={() => onToggle(tile)}
        title="클릭해서 마킹 해제"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-200 text-sm font-bold text-gray-400 transition-all"
      >
        <span className="line-through">{tile}</span>
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-400 text-[8px] text-white">✓</span>
      </button>
    );
  }

  const base = color === 'black'
    ? 'bg-slate-800 text-slate-100 border-slate-600'
    : 'bg-white text-slate-800 border-gray-300';

  const highlight = highlighted
    ? 'ring-2 ring-amber-400 ring-offset-1'
    : '';

  return (
    <button
      onClick={() => onToggle(tile)}
      title="클릭해서 사용된 것으로 표시"
      className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all hover:opacity-75 ${base} ${highlight}`}
    >
      {tile}
    </button>
  );
}
