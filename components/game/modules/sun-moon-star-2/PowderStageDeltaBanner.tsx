'use client';

import type {
  SMS2PlayerPublic,
  SMS2PowderStage,
  SMS2RoundRecord,
  SMS2Side,
} from '@/shared/types/sun-moon-star-2';

/* ════════════════════════════════════════════════════════════
 * PowderStageDeltaBanner
 *   betFirst/betSecond 진입 시 이번 라운드에서 몇 칸 꺼졌는지 표시.
 *   공개 정보(단계)만 사용하므로 정보 은닉 위반 없음.
 * ════════════════════════════════════════════════════════════ */

interface Props {
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
  /** 직전 라운드 기록 (없으면 1라운드 최초) */
  lastRecord: SMS2RoundRecord | null;
  mySide: SMS2Side | null;
}

export default function PowderStageDeltaBanner({ players, lastRecord, mySide }: Props) {
  const entries = (['p1', 'p2'] as SMS2Side[]).map((side) => {
    const currentStage = players[side].powderStage;
    const prevStage: SMS2PowderStage = lastRecord?.stageAfter[side] ?? 5;
    const diff = prevStage - currentStage;
    const isMe = side === mySide;
    const label = isMe ? '나' : players[side].nickname;
    return { side, label, diff, currentStage };
  });

  const anyChanged = entries.some((e) => e.diff > 0);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 lg:px-4 lg:py-2.5">
      <span className="text-sm lg:text-base">💡</span>
      <div className="flex flex-1 items-center justify-around gap-2">
        {entries.map(({ side, label, diff }, i) => (
          <div
            key={side}
            className="flex flex-col items-center"
            style={{ animation: `sms2FadeIn 200ms ease-out ${i * 120}ms both` }}
          >
            <span className="text-[10px] font-bold text-gray-500 lg:text-xs">{label}</span>
            <span
              className={`text-xs font-extrabold tabular-nums lg:text-sm ${
                diff > 0 ? 'text-orange-600' : 'text-gray-400'
              }`}
            >
              {diff > 0 ? `${diff}칸 꺼짐` : '유지'}
            </span>
          </div>
        ))}
      </div>
      {!anyChanged && (
        <span className="text-[10px] text-gray-400 lg:text-xs">꺼진 칸 없음</span>
      )}
    </div>
  );
}
