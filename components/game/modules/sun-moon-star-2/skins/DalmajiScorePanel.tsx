'use client';

import type { SMS2PlayerPublic, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';

interface Props {
  p1: SMS2PlayerPublic;
  p2: SMS2PlayerPublic;
  firstSide: SMS2Side;
  myId: string;
}

export default function DalmajiScorePanel({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-[#c9b888]/70">점수 · 칩</p>
      {([p1, p2] as const).map((p) => {
        const isMe = p.id === myId;
        const range = powderStageRange(p.powderStage);
        return (
          <div
            key={p.side}
            className={`skin-dalmaji-scorepanel ${isMe ? 'skin-dalmaji-scorepanel--me' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-[#f6e7b0]">
                {isMe ? '나' : p.nickname}
                {p.side === firstSide && <span className="ml-1 text-[#e8c56a]">선</span>}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-2xl font-extrabold tabular-nums text-[#fff4d4]">{p.chips}칩</span>
              <span className="text-right">
                <span className="block text-[10px] text-[#c9b888]/70">빛가루</span>
                <span className="block text-xs font-bold tabular-nums text-[#f6e7b0]">
                  {p.powderStage}단계
                </span>
                <span className="block text-[10px] tabular-nums text-[#c9b888]/60">
                  {range.min}~{range.max}g
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
