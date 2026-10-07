'use client';

import type { MBNWTile, MBNWTileColor } from '@/shared/types/multiple-bnw';
import { MBNW_TILE_COLOR, MBNW_TILE_SET } from '@/shared/types/multiple-bnw';
import styles from './multiple-bnw.module.css';
import type { TileNote, TileNotes } from './tileTracker';

interface OpponentTileTrackerProps {
  notes: TileNotes;
  onToggle: (tile: MBNWTile) => void;
  /** 이번 라운드 상대 타일 색 (hint 하이라이트용) */
  opponentCurrentColor?: MBNWTileColor | null;
}

export default function OpponentTileTracker({
  notes,
  onToggle,
  opponentCurrentColor,
}: OpponentTileTrackerProps) {
  const whites = MBNW_TILE_SET.filter((t) => MBNW_TILE_COLOR[t] === 'white');
  const blacks = MBNW_TILE_SET.filter((t) => MBNW_TILE_COLOR[t] === 'black');

  return (
    <div className={`${styles.tracker} mbnw-tracker flex flex-col gap-2`}>
      <p className="mbnw-panel-title text-xs font-semibold text-gray-500">상대 타일 추리</p>

      <div className="flex flex-col gap-2">
        <div>
          <p className="mbnw-tile-group-label mb-1 text-[11px] text-gray-400">백색</p>
          <div className="flex flex-wrap gap-1.5">
            {whites.map((t) => (
              <TrackerTile
                key={t}
                tile={t}
                color="white"
                note={notes[t]}
                highlighted={opponentCurrentColor === 'white' && !notes[t]}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mbnw-tile-group-label mb-1 text-[11px] text-gray-400">흑색</p>
          <div className="flex flex-wrap gap-1.5">
            {blacks.map((t) => (
              <TrackerTile
                key={t}
                tile={t}
                color="black"
                note={notes[t]}
                highlighted={opponentCurrentColor === 'black' && !notes[t]}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-cdm-fg-muted text-[11px]">클릭: ? → 꺼짐 → 원래 타일</p>
    </div>
  );
}

function TrackerTile({
  tile,
  color,
  note,
  highlighted,
  onToggle,
}: {
  tile: MBNWTile;
  color: MBNWTileColor;
  note?: TileNote;
  highlighted: boolean;
  onToggle: (tile: MBNWTile) => void;
}) {
  const label = `${color === 'black' ? '흑색' : '백색'} ${tile}, ${note === 'uncertain' ? '미확정' : note === 'used' ? '사용됨' : '원래 타일'}`;
  if (note === 'used') {
    return (
      <button
        onClick={() => onToggle(tile)}
        type="button"
        aria-label={label}
        data-note="used"
        title="클릭하면 원래 타일로 복원"
        className="mbnw-tracker-tile mbnw-tracker-tile--marked relative flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-200 text-sm font-bold text-gray-400 transition-all"
      >
        <span className="line-through">{tile}</span>
      </button>
    );
  }

  if (note === 'uncertain') {
    return (
      <button
        type="button"
        onClick={() => onToggle(tile)}
        aria-label={label}
        data-note="uncertain"
        title="클릭하면 사용된 타일로 표시"
        className="mbnw-tracker-tile mbnw-tracker-tile--uncertain border-cdm-highlight bg-cdm-highlight-soft text-cdm-highlight-strong flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all hover:opacity-75"
      >
        ?
      </button>
    );
  }

  const base =
    color === 'black'
      ? 'bg-slate-800 text-slate-100 border-slate-600'
      : 'bg-white text-slate-800 border-gray-300';

  const highlight = highlighted ? 'ring-2 ring-amber-400 ring-offset-1' : '';

  return (
    <button
      onClick={() => onToggle(tile)}
      type="button"
      aria-label={label}
      data-note="available"
      title="클릭하면 노란색 ?로 표시"
      className={`mbnw-tracker-tile mbnw-tracker-tile--${color} ${highlighted ? 'mbnw-tracker-tile--highlighted' : ''} flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all hover:opacity-75 ${base} ${highlight}`}
    >
      {tile}
    </button>
  );
}
