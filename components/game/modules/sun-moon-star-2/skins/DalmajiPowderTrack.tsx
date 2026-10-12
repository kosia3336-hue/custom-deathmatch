'use client';

import type { SMS2PowderStage } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';
import { POWDER_STAGE_LABELS } from '../constants';

interface Props {
  leftLabel: string;
  leftStage: SMS2PowderStage;
  leftRemain: number | null;
  leftIsFirst: boolean;
  leftChips: number;
  rightLabel: string;
  rightStage: SMS2PowderStage;
  rightRemain: number | null;
  rightIsFirst: boolean;
  rightChips: number;
  compact?: boolean;
  chipsInLabel?: boolean;
}

type RowState = 'dim' | 'active' | 'lit';

function rowState(rowStage: number, playerStage: number): RowState {
  if (rowStage > playerStage) return 'dim';
  if (rowStage === playerStage) return 'active';
  return 'lit';
}

const STAGES = [5, 4, 3, 2, 1] as const;

export default function DalmajiPowderTrack({
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
    <div data-panel-inset className="skin-dalmaji-track">
      <div className="flex items-center gap-1 pb-1">
        <div className="flex min-w-0 flex-1 items-center justify-center text-xs font-semibold text-[#f0d078]">
          {chipsInLabel ? (
            <>
              <span className="shrink-0 font-bold text-[#fff4d4] tabular-nums">칩 {leftChips}</span>
              <span className="ml-0.5 truncate">({leftLabel})</span>
            </>
          ) : (
            <span className="truncate">{leftLabel}</span>
          )}
          {leftIsFirst && <span className="ml-1 shrink-0">선</span>}
        </div>
        <div className="w-16 shrink-0 text-center text-[11px] text-[#c9b888]/70">빛가루</div>
        <div className="flex min-w-0 flex-1 items-center justify-center text-xs font-semibold text-[#e8c56a]">
          {chipsInLabel ? (
            <>
              <span className="shrink-0 font-bold text-[#fff4d4] tabular-nums">
                칩 {rightChips}
              </span>
              <span className="ml-0.5 truncate">({rightLabel})</span>
            </>
          ) : (
            <span className="truncate">{rightLabel}</span>
          )}
          {rightIsFirst && <span className="ml-1 shrink-0">선</span>}
        </div>
      </div>

      {!compact && (
        <div className="flex items-center gap-1 pb-2">
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-[#f6e7b0] tabular-nums">{leftChips}</div>
            <div className="text-[11px] text-[#c9b888]/70">칩</div>
          </div>
          <div className="w-16 shrink-0 text-center text-[11px] text-[#c9b888]/60">단계(g)</div>
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-[#f6e7b0] tabular-nums">{rightChips}</div>
            <div className="text-[11px] text-[#c9b888]/70">칩</div>
          </div>
        </div>
      )}

      {STAGES.map((s) => (
        <StageRow key={s} stage={s} leftStage={leftStage} rightStage={rightStage} />
      ))}

      <div className="flex items-center gap-1 pt-1">
        <div className="flex-1 text-center text-[11px] font-medium text-[#f0d078] tabular-nums">
          {leftRemain !== null ? `${leftRemain}g` : stageRange(leftStage)}
        </div>
        <div className="w-16 shrink-0" />
        <div className="flex-1 text-center text-[11px] font-medium text-[#e8c56a] tabular-nums">
          {rightRemain !== null ? `${rightRemain}g` : stageRange(rightStage)}
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="flex items-center gap-1">
      <div className={`skin-dalmaji-well skin-dalmaji-well--left skin-dalmaji-well--${L}`} />
      <div className="skin-dalmaji-well-label">{POWDER_STAGE_LABELS[stage]}</div>
      <div className={`skin-dalmaji-well skin-dalmaji-well--right skin-dalmaji-well--${R}`} />
    </div>
  );
}

/** 61~80g — 상대는 남은 양을 모르니 그 단계의 g 구간을 보인다 */
function stageRange(stage: SMS2PowderStage) {
  const { min, max } = powderStageRange(stage);
  return `${min}~${max}g`;
}
