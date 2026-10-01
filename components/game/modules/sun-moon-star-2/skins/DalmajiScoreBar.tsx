'use client';

import type { SMS2PlayerPublic, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';

interface Props {
  p1: SMS2PlayerPublic;
  p2: SMS2PlayerPublic;
  firstSide: SMS2Side;
  myId: string;
}

export default function DalmajiScoreBar({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="skin-dalmaji-scorebar">
      {([p1, p2] as const).map((p, i) => {
        const isMe = p.id === myId;
        const range = powderStageRange(p.powderStage);
        return (
          <div
            key={p.side}
            className={`skin-dalmaji-scorebar-row ${isMe ? 'skin-dalmaji-scorebar-row--me' : ''} ${
              i === 0 ? 'skin-dalmaji-scorebar-row--first' : ''
            }`}
          >
            <span className="skin-dalmaji-scorebar-name">
              {isMe ? '나' : p.nickname}
              {p.side === firstSide && <span className="ml-0.5 text-[10px]">선</span>}
            </span>
            <div className="grid min-w-0 flex-1 grid-cols-5 gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  className={`h-2 rounded-sm ${
                    s < p.powderStage
                      ? 'skin-dalmaji-scorebar-cell--lit'
                      : s === p.powderStage
                        ? 'skin-dalmaji-scorebar-cell--active'
                        : 'skin-dalmaji-scorebar-cell--dim'
                  }`}
                />
              ))}
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-[#c9b888]/80">
              {p.powderStage}단 {range.min}~{range.max}g
            </span>
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#f6e7b0]">
              {p.chips}칩
            </span>
          </div>
        );
      })}
    </div>
  );
}
