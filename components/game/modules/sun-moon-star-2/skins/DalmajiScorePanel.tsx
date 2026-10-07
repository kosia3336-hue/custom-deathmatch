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
    <div className="grid grid-cols-2 gap-2">
      {[p1, p2]
        .sort((a, b) => Number(b.id === myId) - Number(a.id === myId))
        .map((p) => {
          const isMe = p.id === myId;
          const range = powderStageRange(p.powderStage);
          return (
            <div
              key={p.side}
              style={{ padding: 8, gap: 4 }}
              className={`skin-dalmaji-scorepanel ${isMe ? 'skin-dalmaji-scorepanel--me' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-[#f6e7b0]">
                  {isMe ? '나' : p.nickname}
                  {p.side === firstSide && <span className="ml-1 text-[#e8c56a]">선</span>}
                </span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-lg font-extrabold text-[#fff4d4] tabular-nums">
                  {p.chips}칩
                </span>
                <span className="text-right text-[11px] text-[#c9b888]/70">
                  빛가루 {p.powderStage}단계
                  <br />
                  {range.min}~{range.max}g
                </span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
