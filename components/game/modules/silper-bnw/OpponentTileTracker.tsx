'use client';

import type { SkinTheme } from '@/lib/skins/registry';
import { SBNW_INITIAL_TILES, SBNW_TILES, type SBNWTile } from '@/shared/types/silper-bnw';
import type { SilperTileNote } from '@/lib/silperTileNotes';

export default function OpponentTileTracker({
  note,
  round,
  currentRound,
  selectRound,
  setNote,
  clearNote,
  skin,
}: {
  note: SilperTileNote;
  round: number;
  currentRound: number;
  selectRound: (round: number) => void;
  setNote: (tile: SBNWTile, value: number) => void;
  clearNote: () => void;
  skin?: SkinTheme | null;
}) {
  const isMeow = skin === 'meow';
  const unchanged = SBNW_TILES.every((tile) => note[tile] === SBNW_INITIAL_TILES[tile]);
  return (
    <section
      aria-label={`R${round} 타일 추리`}
      className={isMeow ? 'skin-meow-heading' : 'text-cdm-fg'}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1 text-[11px]">
        <span className="text-cdm-fg-muted">{round < currentRound ? '이전 기록' : ''}</span>
        <div className="ml-auto flex items-center gap-1" aria-label="메모 라운드 선택">
          <button
            type="button"
            onClick={clearNote}
            disabled={unchanged}
            className="mr-1 px-1 py-1 disabled:opacity-30"
          >
            초기화
          </button>
          <button
            type="button"
            aria-label="이전 라운드 메모"
            disabled={round <= 1}
            onClick={() => selectRound(round - 1)}
            className="border-cdm-border h-7 w-7 rounded border text-base disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-8 text-center font-semibold">R{round}</span>
          <button
            type="button"
            aria-label="다음 라운드 메모"
            disabled={round >= currentRound}
            onClick={() => selectRound(round + 1)}
            className="border-cdm-border h-7 w-7 rounded border text-base disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {SBNW_TILES.map((tile) => (
          <div key={tile} className="flex min-w-0 flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-xs">
              <strong>{tile}</strong>
              <span className="text-cdm-fg-muted">×</span>
              <input
                key={`${round}-${tile}-${note[tile]}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={SBNW_INITIAL_TILES[tile]}
                step={1}
                defaultValue={note[tile]}
                aria-label={`${tile} 타일 추리값`}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => {
                  const raw = event.currentTarget.value;
                  const value = Number(raw);
                  if (raw !== '' && Number.isInteger(value)) {
                    const normalized = Math.max(0, Math.min(SBNW_INITIAL_TILES[tile], value));
                    event.currentTarget.value = String(normalized);
                    setNote(tile, normalized);
                  } else event.currentTarget.value = String(note[tile]);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className="border-cdm-border w-6 [appearance:textfield] rounded border bg-transparent py-0.5 text-center text-xs font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={`${tile} 감소`}
                disabled={note[tile] <= 0}
                onClick={() => setNote(tile, note[tile] - 1)}
                className={`border-cdm-border h-7 w-6 rounded border text-base disabled:opacity-30 ${isMeow ? 'skin-meow-tracker-btn' : ''}`}
              >
                −
              </button>
              <button
                type="button"
                aria-label={`${tile} 증가`}
                disabled={note[tile] >= SBNW_INITIAL_TILES[tile]}
                onClick={() => setNote(tile, note[tile] + 1)}
                className={`border-cdm-border h-7 w-6 rounded border text-base disabled:opacity-30 ${isMeow ? 'skin-meow-tracker-btn' : ''}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
