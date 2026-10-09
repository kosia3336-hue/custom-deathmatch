'use client';

import { Icon } from '@/components/cdm/Icon';
import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';
import type { OpponentPowderEstimate } from './types';

/*
  상대 빛가루 추리 — 한 줄 메모.

  예전에는 모바일에서 '메모 열기' 를 눌러 시트를 띄우고, 그 안에서 해·달·별을
  줄마다 −/+ 로 적었다. 한 라운드에 숫자 세 개를 적는 데 시트까지 여닫아야 했고,
  적는 동안 판이 가려졌다. 이제 라운드 넘김 · 해 · 달 · 별 · 합을 한 줄에 두고
  바로 적는다. 칸을 누르면 숫자가 통째로 선택돼 바로 덮어 쓸 수 있다.
*/

interface Props {
  dalmaji: boolean;
  round: number;
  latestRound: number;
  estimate: OpponentPowderEstimate;
  max: number;
  onSelectRound: (round: number) => void;
  onChange: (mark: SMS2MarkId, value: number) => void;
  onReset: () => void;
}

export default function OpponentPowderMemo({
  round,
  latestRound,
  estimate,
  max,
  onSelectRound,
  onChange,
  onReset,
}: Props) {
  const total = estimate.perMark.sun + estimate.perMark.moon + estimate.perMark.star;
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.floor(v)));
  const navButton =
    'text-cdm-fg-muted hover:text-cdm-fg flex h-8 w-6 shrink-0 items-center justify-center text-base disabled:opacity-30';
  return (
    <div data-powder-note-round={round} className="flex min-w-0 items-center gap-1.5">
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          aria-label="추리 이전 라운드"
          disabled={round <= 1}
          onClick={() => onSelectRound(round - 1)}
          className={navButton}
        >
          ‹
        </button>
        <span className="text-cdm-fg min-w-7 text-center text-xs font-semibold tabular-nums">
          R{round}
        </span>
        <button
          type="button"
          aria-label="추리 다음 라운드"
          disabled={round >= latestRound}
          onClick={() => onSelectRound(round + 1)}
          className={navButton}
        >
          ›
        </button>
      </div>
      {MARK_IDS.map((mark) => {
        const style = MARK_STYLES[mark];
        return (
          <label key={mark} className="flex min-w-0 flex-1 items-center gap-0.5">
            <span aria-hidden className="shrink-0 text-sm">
              {style.icon}
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={estimate.perMark[mark]}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                onChange(mark, clamp(isNaN(n) ? 0 : n));
              }}
              aria-label={`${style.label} 상대 추정`}
              className="border-cdm-border bg-cdm-bg text-cdm-fg focus:ring-cdm-primary h-8 w-full min-w-0 rounded border text-center text-sm font-bold tabular-nums focus:ring-2 focus:outline-none"
            />
          </label>
        );
      })}
      <span className="text-cdm-fg-muted shrink-0 text-xs tabular-nums">
        합 <span className="text-cdm-fg font-bold">{total}</span>
      </span>
      <button
        type="button"
        onClick={onReset}
        aria-label="추리 초기화"
        title="초기화"
        className="text-cdm-fg-muted hover:text-cdm-fg flex h-8 w-6 shrink-0 items-center justify-center"
      >
        <Icon name="undo" size="sm" />
      </button>
    </div>
  );
}
