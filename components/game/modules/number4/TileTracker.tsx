'use client';

import { useCallback } from 'react';
import { INITIAL_WHITE, INITIAL_BLACK } from '@/shared/types/number4';
import type { SkinTheme } from '@/lib/skins/registry';
import DualityTrackerShell from './skins/DualityTrackerShell';
import { DualityTile } from './skins/DualityTile';

interface TileTrackerProps {
  playerNickname?: string;
  white: number;
  black: number;
  onAdjust: (color: 'white' | 'black', delta: number) => void;
  skin?: SkinTheme | null;
}

export default function TileTracker({ playerNickname, white, black, onAdjust, skin }: TileTrackerProps) {
  const adjust = useCallback(
    (color: 'white' | 'black', delta: number) => { onAdjust(color, delta); },
    [onAdjust],
  );
  const isDuality = skin === 'duality';

  const rows = (
    <div className="flex flex-col gap-2">
      {/* 백색 행 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isDuality
            ? <DualityTile type="frost" size="xs" />
            : <div className="h-5 w-5 shrink-0 rounded border border-gray-300 bg-white" />
          }
          <span className={`text-xs ${isDuality ? 'text-slate-400' : 'text-cdm-ink-fg-muted'}`}>백색</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjust('white', -1)}
            disabled={white <= 0}
            aria-label="백색 감소"
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold transition-colors ${
              isDuality
                ? 'skin-duality-tracker-btn'
                : 'border border-cdm-ink-border bg-white/5 text-cdm-ink-fg hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30'
            }`}
          >
            −
          </button>
          <span className={`w-8 text-center text-sm font-semibold tabular-nums ${isDuality ? 'skin-duality-tracker-count' : 'text-cdm-ink-fg'}`}>
            {white}
          </span>
          <button
            onClick={() => adjust('white', 1)}
            disabled={white >= INITIAL_WHITE}
            aria-label="백색 증가"
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold transition-colors ${
              isDuality
                ? 'skin-duality-tracker-btn'
                : 'border border-cdm-ink-border bg-white/5 text-cdm-ink-fg hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30'
            }`}
          >
            +
          </button>
        </div>
      </div>

      {/* 흑색 행 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isDuality
            ? <DualityTile type="obsidian" size="xs" />
            : <div className="h-5 w-5 shrink-0 rounded border border-white/40 bg-black" />
          }
          <span className={`text-xs ${isDuality ? 'text-slate-400' : 'text-cdm-ink-fg-muted'}`}>흑색</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjust('black', -1)}
            disabled={black <= 0}
            aria-label="흑색 감소"
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold transition-colors ${
              isDuality
                ? 'skin-duality-tracker-btn'
                : 'border border-cdm-ink-border bg-white/5 text-cdm-ink-fg hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30'
            }`}
          >
            −
          </button>
          <span className={`w-8 text-center text-sm font-semibold tabular-nums ${isDuality ? 'skin-duality-tracker-count' : 'text-cdm-ink-fg'}`}>
            {black}
          </span>
          <button
            onClick={() => adjust('black', 1)}
            disabled={black >= INITIAL_BLACK}
            aria-label="흑색 증가"
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold transition-colors ${
              isDuality
                ? 'skin-duality-tracker-btn'
                : 'border border-cdm-ink-border bg-white/5 text-cdm-ink-fg hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30'
            }`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );

  if (isDuality) {
    return (
      <DualityTrackerShell>
        <div className="mb-2 text-xs font-semibold tracking-wide skin-duality-tracker-label">
          {playerNickname ? `${playerNickname} 타일 추리` : '상대 타일 추리'}
        </div>
        {rows}
      </DualityTrackerShell>
    );
  }

  return (
    // 판 정보 칸(GameInfoPart, 짙은 배경) 안에서만 쓰인다 — 글자·테두리는 ink 토큰
    <div className="w-full rounded-xl border border-cdm-ink-border bg-white/5 p-3">
      <div className="mb-2 text-xs font-semibold tracking-wide text-cdm-ink-fg-muted">
        {playerNickname ? `${playerNickname} 타일 추리` : '상대 타일 추리'}
      </div>
      {rows}
    </div>
  );
}
