'use client';
import { useGameAction } from '@/components/game/GameActionContext';

import type { MBNWTile, MBNWTileColor } from '@/shared/types/multiple-bnw';
import { MBNW_TILE_COLOR } from '@/shared/types/multiple-bnw';
import { useState } from 'react';

interface TileSelectorProps {
  remainingTiles: MBNWTile[];
  actionType: 'submitTile' | 'respondTile';
  firstColor?: MBNWTileColor | null;
}

export default function TileSelector({
  remainingTiles,
  actionType,
  firstColor,
}: TileSelectorProps) {
  const sendAction = useGameAction();
  const [selected, setSelected] = useState<MBNWTile | null>(
    remainingTiles.length === 1 ? remainingTiles[0] : null,
  );

  const whites = remainingTiles.filter((t) => MBNW_TILE_COLOR[t] === 'white').sort((a, b) => a - b);
  const blacks = remainingTiles.filter((t) => MBNW_TILE_COLOR[t] === 'black').sort((a, b) => a - b);

  const handleSubmit = () => {
    if (selected == null) return;
    sendAction({ type: actionType, tile: selected });
  };

  return (
    <div
      data-game-panel
      className="mbnw-panel mbnw-tile-selector flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4"
    >
      {actionType === 'respondTile' && firstColor && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">선플 타일:</span>
          <span
            className={`mbnw-color-badge mbnw-color-badge--${firstColor} inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              firstColor === 'black'
                ? 'bg-slate-800 text-slate-100'
                : 'border border-gray-300 bg-white text-slate-700'
            }`}
          >
            {firstColor === 'black' ? '흑색' : '백색'}
          </span>
        </div>
      )}

      <p className="mbnw-panel-title text-sm font-medium text-gray-700">타일을 선택하세요</p>

      {whites.length > 0 && (
        <div>
          <p className="mbnw-tile-group-label mb-1 text-xs text-gray-400">백색</p>
          <div className="flex flex-wrap gap-2">
            {whites.map((t) => (
              <TileButton
                key={t}
                tile={t}
                color="white"
                selected={selected === t}
                onClick={() => setSelected(t)}
              />
            ))}
          </div>
        </div>
      )}

      {blacks.length > 0 && (
        <div>
          <p className="mbnw-tile-group-label mb-1 text-xs text-gray-400">흑색</p>
          <div className="flex flex-wrap gap-2">
            {blacks.map((t) => (
              <TileButton
                key={t}
                tile={t}
                color="black"
                selected={selected === t}
                onClick={() => setSelected(t)}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={selected == null}
        className="mbnw-primary-action mt-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
      >
        확인
      </button>
    </div>
  );
}

function TileButton({
  tile,
  color,
  selected,
  onClick,
}: {
  tile: MBNWTile;
  color: MBNWTileColor;
  selected: boolean;
  onClick: () => void;
}) {
  const base =
    color === 'black'
      ? 'bg-slate-800 text-slate-100 border-slate-600'
      : 'bg-white text-slate-800 border-gray-300';
  const sel = selected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-gray-400';

  return (
    <button
      onClick={onClick}
      className={`mbnw-tile mbnw-tile--${color} ${selected ? 'mbnw-tile--selected' : ''} flex h-[52px] w-[52px] items-center justify-center rounded-lg border-2 text-lg font-bold transition-all sm:h-[44px] sm:w-[44px] ${base} ${sel}`}
    >
      {tile}
    </button>
  );
}
