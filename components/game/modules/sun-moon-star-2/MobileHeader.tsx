'use client';

import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';
import { PHASE_LABELS } from './constants';

/* ════════════════════════════════════════════════════════════
 * MobileHeader — 모바일 한 줄 sticky 헤더
 *   R3/10  ·  분배 중  ·  ⏱ 00:12  · ⚙
 *   서든데스 시 좌측에 빨간 pill
 * ════════════════════════════════════════════════════════════ */

interface Props {
  round: number;
  maxRound: number;
  phase: SMS2GameData['phase'];
  suddenDeath: boolean;
  firstNick: string;
}

export default function MobileHeader({
  round,
  maxRound,
  phase,
  suddenDeath,
  firstNick,
}: Props) {
  const phaseLabel = PHASE_LABELS[phase] ?? '';
  return (
    <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-1 flex items-center gap-2 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur">
      {suddenDeath && (
        <span className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          서든데스
        </span>
      )}
      <span className="shrink-0 text-base font-extrabold tabular-nums text-gray-800">
        R{round}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-gray-400">/{maxRound}</span>
      {phaseLabel && (
        <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
          {phaseLabel}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-right text-[11px] text-amber-600">
        {firstNick} 선 👑
      </span>
    </div>
  );
}
