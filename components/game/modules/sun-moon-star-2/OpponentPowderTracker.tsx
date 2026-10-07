'use client';

import type { SMS2MarkId, SMS2PowderStage } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, powderStageRange } from '@/shared/types/sun-moon-star-2';
import { useCallback, useMemo } from 'react';
import { MARK_STYLES } from './constants';
import { type OpponentPowderEstimate, opponentUsedRange } from './types';

/* "중앙값 스케일" 자동 정렬 버튼 제거됨 (2026-04 UX 개선) */

/* ════════════════════════════════════════════════════════════
 * OpponentPowderTracker — 상대 빛가루 추리 (클라 전용)
 *   · 상대 stage 변경 시 부모에서 key 로 리마운트 → 자동 초기화
 *   · 이번 라운드 추정 사용량 범위 안에서 표식별 메모
 *   · 절대 서버로 전송되지 않음
 * ════════════════════════════════════════════════════════════ */

interface Props {
  stageNow: SMS2PowderStage;
  stagePrev: SMS2PowderStage;
  estimate: OpponentPowderEstimate;
  onChange: (next: OpponentPowderEstimate) => void;
  onReset: () => void;
}

export default function OpponentPowderTracker({
  stageNow,
  stagePrev,
  estimate,
  onChange,
  onReset,
}: Props) {
  const range = useMemo(() => opponentUsedRange(stagePrev, stageNow), [stagePrev, stageNow]);
  const prevRangeText = useMemo(() => {
    const r = powderStageRange(stagePrev);
    return `${r.min}~${r.max}g`;
  }, [stagePrev]);
  const nowRangeText = useMemo(() => {
    const r = powderStageRange(stageNow);
    return `${r.min}~${r.max}g`;
  }, [stageNow]);

  const total = estimate.perMark.sun + estimate.perMark.moon + estimate.perMark.star;
  const outOfRange = total < range.min || total > range.max;

  const setSlot = useCallback(
    (slot: SMS2MarkId, next: number) => {
      const clamped = Math.max(0, Math.min(range.max, Math.floor(next)));
      onChange({
        ...estimate,
        perMark: { ...estimate.perMark, [slot]: clamped },
      });
    },
    [estimate, range.max, onChange],
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-600">🔍 상대 빛가루 추리</p>
        <button
          type="button"
          onClick={onReset}
          className="rounded text-[11px] font-medium text-gray-400 hover:text-gray-600"
        >
          초기화
        </button>
      </div>

      {/* 단계/추정 범위 */}
      <div className="rounded bg-white px-2 py-1.5 text-[11px] text-gray-600">
        직전{' '}
        <span className="font-bold text-gray-800">
          {stagePrev}단계 ({prevRangeText})
        </span>
        <span className="mx-1 text-gray-400">→</span>
        현재{' '}
        <span className="font-bold text-gray-800">
          {stageNow}단계 ({nowRangeText})
        </span>
        <div className="mt-0.5 text-[11px] text-gray-500">
          이번 라운드 추정 사용량:{' '}
          <span className="font-bold text-amber-600 tabular-nums">
            {range.min}~{range.max}g
          </span>
          <span className="text-gray-400"> (중앙값 {range.median}g)</span>
        </div>
      </div>

      {/* 표식별 추정 */}
      <div className="space-y-1">
        {MARK_IDS.map((m) => (
          <EstimateSlot
            key={m}
            mark={m}
            value={estimate.perMark[m]}
            max={range.max}
            onChange={(v) => setSlot(m, v)}
          />
        ))}
      </div>

      {/* 총합 */}
      <div className="flex items-center justify-between rounded bg-white px-2 py-1 text-[11px]">
        <span className="text-gray-600">
          합 <span className="font-bold text-gray-800 tabular-nums">{total}g</span>
        </span>
        {outOfRange ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
            범위 밖
          </span>
        ) : (
          <span className="text-[11px] text-emerald-600">범위 내 ✓</span>
        )}
      </div>
    </div>
  );
}

function EstimateSlot({
  mark,
  value,
  max,
  onChange,
}: {
  mark: SMS2MarkId;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const style = MARK_STYLES[mark];
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.floor(v)));
  return (
    <div className="flex items-center gap-1.5 rounded bg-white px-2 py-1">
      <span className="flex w-10 shrink-0 items-center gap-1">
        <span className="text-sm">{style.icon}</span>
        <span className={`text-[11px] font-bold ${style.textSoft}`}>{style.label}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 0}
        className="h-8 w-8 shrink-0 rounded border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(clamp(isNaN(n) ? 0 : n));
        }}
        aria-label={`${style.label} 상대 추정`}
        className="h-8 min-w-0 flex-1 rounded border border-gray-200 bg-white text-center text-sm font-bold text-gray-700 tabular-nums focus:ring-2 focus:ring-gray-300 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="h-8 w-8 shrink-0 rounded border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
