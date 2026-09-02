'use client';

import type { BNW2PlayerInfo } from '@/shared/types/bnw2';

interface Props {
  leftPlayer: BNW2PlayerInfo;
  rightPlayer: BNW2PlayerInfo;
  leftLabel: string;
  rightLabel: string;
}

const STAGES = Array.from({ length: 10 }, (_, i) => {
  const stage = 10 - i;
  const hi = stage * 20;
  const lo = (stage - 1) * 20;
  return { stage, label: lo === 0 ? `${lo}~${hi}` : `${lo + 1}~${hi}` };
});

type RowState = 'dim' | 'active' | 'lit';

function getRowState(rowStage: number, playerStage: number): RowState {
  const effective = playerStage === 0 ? 1 : playerStage;
  if (rowStage > effective) return 'dim';
  if (rowStage === effective) return 'active';
  return 'lit';
}

function StageRow({
  stage,
  label,
  leftStage,
  rightStage,
}: {
  stage: number;
  label: string;
  leftStage: number;
  rightStage: number;
}) {
  const leftState = getRowState(stage, leftStage);
  const rightState = getRowState(stage, rightStage);

  const leftCls =
    leftState === 'active'
      ? 'bg-indigo-900 opacity-100 [box-shadow:inset_0_0_0_1px_rgba(99,102,241,0.6)]'
      : leftState === 'lit'
      ? 'bg-indigo-950 opacity-70'
      : 'bg-gray-800 opacity-25';

  const rightCls =
    rightState === 'active'
      ? 'bg-amber-900 opacity-100 [box-shadow:inset_0_0_0_1px_rgba(217,119,6,0.6)]'
      : rightState === 'lit'
      ? 'bg-amber-950 opacity-70'
      : 'bg-gray-800 opacity-25';

  return (
    <div className="flex items-center gap-1">
      <div className={`h-6 flex-1 rounded-l-md transition-colors duration-300 sm:h-7 ${leftCls}`} />
      <div className="flex h-6 w-20 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-[11px] font-medium text-gray-500 sm:h-7">
        {label}
      </div>
      <div className={`h-6 flex-1 rounded-r-md transition-colors duration-300 sm:h-7 ${rightCls}`} />
    </div>
  );
}

export default function PointTrack({ leftPlayer, rightPlayer, leftLabel, rightLabel }: Props) {
  const leftStage = leftPlayer.stage;
  const rightStage = rightPlayer.stage;

  return (
    <div className="space-y-1">
      {/* Player headers */}
      <div className="flex items-center gap-1 pb-1">
        <div className="flex-1 truncate text-center text-xs font-semibold text-indigo-600">{leftLabel}</div>
        <div className="w-20 shrink-0" />
        <div className="flex-1 truncate text-center text-xs font-semibold text-amber-600">{rightLabel}</div>
      </div>

      {/* Score row */}
      <div className="flex items-center gap-1 pb-2">
        <div className="flex-1 text-center text-2xl font-bold text-indigo-700">{leftPlayer.score}</div>
        <div className="w-20 shrink-0 text-center text-[10px] text-gray-400">점수</div>
        <div className="flex-1 text-center text-2xl font-bold text-amber-700">{rightPlayer.score}</div>
      </div>

      {/* Stage rows */}
      {STAGES.map(({ stage, label }) => (
        <StageRow
          key={stage}
          stage={stage}
          label={label}
          leftStage={leftStage}
          rightStage={rightStage}
        />
      ))}

      {/* Remaining points / stage hint */}
      <div className="flex items-center gap-1 pt-1">
        <div className="flex-1 text-center text-[11px] text-gray-400">
          {leftPlayer.remainingPoints !== null ? `${leftPlayer.remainingPoints}p` : `${leftStage}단계`}
        </div>
        <div className="w-20 shrink-0" />
        <div className="flex-1 text-center text-[11px] text-gray-400">
          {rightPlayer.remainingPoints !== null ? `${rightPlayer.remainingPoints}p` : `${rightStage}단계`}
        </div>
      </div>
    </div>
  );
}
