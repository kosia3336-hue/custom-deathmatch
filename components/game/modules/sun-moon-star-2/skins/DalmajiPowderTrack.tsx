'use client';

import type { SMS2PowderStage } from '@/shared/types/sun-moon-star-2';
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
}: Props) {
  return (
    <div className="skin-dalmaji-track">
      <div className="flex items-center gap-1 pb-1">
        <div className="flex-1 truncate text-center text-xs font-semibold text-[#f0d078]">
          {leftLabel}
          {leftIsFirst && <span className="ml-1">선</span>}
        </div>
        <div className="w-16 shrink-0 text-center text-[10px] text-[#c9b888]/70">빛가루</div>
        <div className="flex-1 truncate text-center text-xs font-semibold text-[#e8c56a]">
          {rightLabel}
          {rightIsFirst && <span className="ml-1">선</span>}
        </div>
      </div>

      {!compact && (
        <div className="flex items-center gap-1 pb-2">
          <div className="flex-1 text-center">
            <div className="text-lg font-bold tabular-nums text-[#f6e7b0]">{leftChips}</div>
            <div className="text-[10px] text-[#c9b888]/70">칩</div>
          </div>
          <div className="w-16 shrink-0 text-center text-[10px] text-[#c9b888]/60">단계(g)</div>
          <div className="flex-1 text-center">
            <div className="text-lg font-bold tabular-nums text-[#f6e7b0]">{rightChips}</div>
            <div className="text-[10px] text-[#c9b888]/70">칩</div>
          </div>
        </div>
      )}

      {STAGES.map((s) => (
        <StageRow key={s} stage={s} leftStage={leftStage} rightStage={rightStage} />
      ))}

      <div className="flex items-center gap-1 pt-1">
        <div className="flex-1 text-center text-[11px] font-medium tabular-nums text-[#f0d078]">
          {leftRemain !== null ? `${leftRemain}g` : `${leftStage}단계`}
        </div>
        <div className="w-16 shrink-0" />
        <div className="flex-1 text-center text-[11px] font-medium tabular-nums text-[#e8c56a]">
          {rightRemain !== null ? `${rightRemain}g` : `${rightStage}단계`}
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
