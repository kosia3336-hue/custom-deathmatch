'use client';

import type { SMS2PowderStage } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';
import { POWDER_STAGE_LABELS } from './constants';

/* ════════════════════════════════════════════════════════════
 * PowderTrack — 중앙 수직 5단계 빛가루 비교 트랙
 * BNW2 PointTrack 축소판 (5단계 × 양측 indigo / amber)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  /** 좌측 (보통 나) */
  leftLabel: string;
  leftStage: SMS2PowderStage;
  leftRemain: number | null;
  leftIsFirst: boolean;
  leftChips: number;
  /** 우측 (보통 상대) */
  rightLabel: string;
  rightStage: SMS2PowderStage;
  rightRemain: number | null;
  rightIsFirst: boolean;
  rightChips: number;
  /**
   * 데스크탑에선 좌측 컬럼의 ScorePanel 이 칩/단계 요약을 이미 들고 있어
   * PowderTrack 내부의 칩 행은 정보 중복.
   * compact=true 면 칩 행을 숨기고 단계 시각화만 표시.
   */
  compact?: boolean;
  /** 칩을 위쪽 이름 옆에 보통 크기로 둔다 — 모바일 점수 칸이 점수 카드 없이 트랙만 쓸 때 */
  chipsInLabel?: boolean;
}

type RowState = 'dim' | 'active' | 'lit';

function rowState(rowStage: number, playerStage: number): RowState {
  if (rowStage > playerStage) return 'dim';
  if (rowStage === playerStage) return 'active';
  return 'lit';
}

const STAGES = [5, 4, 3, 2, 1] as const;

function StageRow({
  stage,
  leftStage,
  rightStage,
}: {
  stage: number;
  leftStage: number;
  rightStage: number;
}) {
  const L = rowState(stage, leftStage);
  const R = rowState(stage, rightStage);

  const leftCls =
    L === 'active'
      ? 'bg-indigo-600 opacity-100 [box-shadow:inset_0_0_0_1px_rgba(99,102,241,0.9)]'
      : L === 'lit'
        ? 'bg-indigo-900 opacity-70'
        : 'bg-gray-200 opacity-60';

  const rightCls =
    R === 'active'
      ? 'bg-amber-500 opacity-100 [box-shadow:inset_0_0_0_1px_rgba(217,119,6,0.9)]'
      : R === 'lit'
        ? 'bg-amber-800 opacity-70'
        : 'bg-gray-200 opacity-60';

  return (
    <div className="flex items-center gap-1">
      <div className={`h-6 flex-1 rounded-l-md transition-colors duration-300 ${leftCls}`} />
      <div className="flex h-6 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-[11px] font-medium text-gray-500 tabular-nums">
        {POWDER_STAGE_LABELS[stage]}
      </div>
      <div className={`h-6 flex-1 rounded-r-md transition-colors duration-300 ${rightCls}`} />
    </div>
  );
}

export default function PowderTrack({
  leftLabel,
  leftStage,
  leftRemain,
  leftIsFirst,
  leftChips,
  rightLabel,
  rightStage,
  rightRemain,
  rightIsFirst,
  rightChips,
  compact = false,
  chipsInLabel = false,
}: Props) {
  return (
    <div className="space-y-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* 상단 플레이어 라벨 + 선 표시 */}
      <div className="flex items-center gap-1 pb-1">
        <div className="flex min-w-0 flex-1 items-center justify-center text-xs font-semibold text-indigo-600">
          {chipsInLabel ? (
            <>
              <span className="shrink-0 font-bold text-purple-700 tabular-nums">
                칩 {leftChips}
              </span>
              <span className="ml-0.5 truncate">({leftLabel})</span>
            </>
          ) : (
            <span className="truncate">{leftLabel}</span>
          )}
          {leftIsFirst && <span className="ml-1 shrink-0 text-amber-500">선</span>}
        </div>
        <div className="w-16 shrink-0 text-center text-[11px] text-gray-400">빛가루</div>
        <div className="flex min-w-0 flex-1 items-center justify-center text-xs font-semibold text-amber-600">
          {chipsInLabel ? (
            <>
              <span className="shrink-0 font-bold text-purple-700 tabular-nums">
                칩 {rightChips}
              </span>
              <span className="ml-0.5 truncate">({rightLabel})</span>
            </>
          ) : (
            <span className="truncate">{rightLabel}</span>
          )}
          {rightIsFirst && <span className="ml-1 shrink-0 text-amber-500">선</span>}
        </div>
      </div>

      {/* 칩/잔여 요약 — compact=true 면 숨김 (데스크탑은 ScorePanel 에 있음) */}
      {!compact && (
        <div className="flex items-center gap-1 pb-2">
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-indigo-700 tabular-nums">칩 {leftChips}</div>
            <div className="text-[11px] text-gray-400">칩</div>
          </div>
          <div className="w-16 shrink-0 text-center text-[11px] text-gray-400">단계(g)</div>
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-amber-700 tabular-nums">칩 {rightChips}</div>
            <div className="text-[11px] text-gray-400">칩</div>
          </div>
        </div>
      )}

      {/* 5단계 바 */}
      {STAGES.map((s) => (
        <StageRow key={s} stage={s} leftStage={leftStage} rightStage={rightStage} />
      ))}

      {/* 하단 힌트 */}
      <div className="flex items-center gap-1 pt-1">
        <div className="flex-1 text-center text-[11px] font-medium text-indigo-500 tabular-nums">
          {leftRemain !== null ? `${leftRemain}g` : stageRange(leftStage)}
        </div>
        <div className="w-16 shrink-0" />
        <div className="flex-1 text-center text-[11px] font-medium text-amber-500 tabular-nums">
          {rightRemain !== null ? `${rightRemain}g` : stageRange(rightStage)}
        </div>
      </div>
    </div>
  );
}

/** 61~80g — 상대는 남은 양을 모르니 그 단계의 g 구간을 보인다 */
function stageRange(stage: SMS2PowderStage) {
  const { min, max } = powderStageRange(stage);
  return `${min}~${max}g`;
}
