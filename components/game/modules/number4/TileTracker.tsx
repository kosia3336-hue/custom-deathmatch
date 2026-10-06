'use client';

import { INITIAL_WHITE, INITIAL_BLACK } from '@/shared/types/number4';
import type { SkinTheme } from '@/lib/skins/registry';

/** 실제 상대 타일과 연결하지 않는 라운드별 개인 메모. */
export default function TileTracker({
  playerNickname,
  white,
  black,
  round,
  currentRound,
  entered,
  onSet,
  onClear,
  onSelectRound,
  showTitle = true,
  skin,
}: {
  playerNickname?: string;
  showTitle?: boolean;
  white: number;
  black: number;
  round: number;
  currentRound: number;
  entered: boolean;
  onSet: (color: 'white' | 'black', value: number) => void;
  onClear: () => void;
  onSelectRound: (round: number) => void;
  skin?: SkinTheme | null;
}) {
  return (
    <section
      aria-label={`R${round} 타일 추리`}
      className={`border-cdm-border text-cdm-fg rounded-xl border px-3 py-2 ${skin === 'duality' ? 'skin-duality-tracker !text-slate-200' : 'bg-cdm-bg-elev-1'}`}
    >
      <div className="text-cdm-fg-muted mb-2 flex flex-wrap items-start justify-between gap-2 text-[11px]">
        <span className="min-w-0">
          {showTitle && <strong className="block">메모 - 상대 타일 추리</strong>}
          {playerNickname && <span className="block">{playerNickname}</span>}
          {round < currentRound && <span>이전 기록</span>}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1" aria-label="메모 라운드 선택">
          <button
            type="button"
            aria-label="이전 라운드 메모"
            disabled={round <= 1}
            onClick={() => onSelectRound(round - 1)}
            className="border-cdm-border h-7 w-7 rounded border text-base disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-8 text-center font-semibold">R{round}</span>
          <button
            type="button"
            aria-label="다음 라운드 메모"
            disabled={round >= currentRound}
            onClick={() => onSelectRound(round + 1)}
            className="border-cdm-border h-7 w-7 rounded border text-base disabled:opacity-30"
          >
            ›
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!entered}
            className="ml-1 px-1 py-1 disabled:opacity-30"
          >
            초기화
          </button>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
        {(['white', 'black'] as const).map((color) => {
          const value = color === 'white' ? white : black;
          const max = color === 'white' ? INITIAL_WHITE : INITIAL_BLACK;
          const label = color === 'white' ? '백색' : '흑색';
          return (
            <div key={color} className="flex items-center gap-1 text-xs">
              <span
                className={`h-4 w-4 rounded border ${color === 'white' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'}`}
              />
              <span>{label}</span>
              <button
                type="button"
                aria-label={`${label} 감소`}
                disabled={value <= 0}
                onClick={() => onSet(color, value - 1)}
                className="border-cdm-border h-8 w-8 rounded-md border text-base disabled:opacity-30"
              >
                −
              </button>
              <input
                key={`${round}-${color}-${value}-${entered}`}
                aria-label={`${label} 추리값`}
                type="number"
                inputMode="numeric"
                step={1}
                min={0}
                max={max}
                defaultValue={entered ? value : ''}
                placeholder="?"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  const raw = e.currentTarget.value;
                  if (raw !== '' && Number.isInteger(Number(raw))) {
                    const normalized = Math.max(0, Math.min(max, Number(raw)));
                    e.currentTarget.value = String(normalized);
                    onSet(color, normalized);
                  } else {
                    e.currentTarget.value = entered ? String(value) : '';
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className="border-cdm-border w-10 [appearance:textfield] rounded border bg-transparent py-1 text-center text-xs font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label={`${label} 증가`}
                disabled={value >= max}
                onClick={() => onSet(color, value + 1)}
                className="border-cdm-border h-8 w-8 rounded-md border text-base disabled:opacity-30"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
