'use client';

import type { SMS2PlayerPublic, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';

/* ════════════════════════════════════════════════════════════
 * ScorePanel — 데스크탑 좌측 컬럼 점수 카드 (세로)
 *   · 본인 indigo / 상대 amber 양분
 *   · 칩 큰 폰트, 단계 텍스트
 *   · ScoreBar(모바일)와 동일 정보를 더 큰 사이즈로
 * ════════════════════════════════════════════════════════════ */

interface Props {
  p1: SMS2PlayerPublic;
  p2: SMS2PlayerPublic;
  firstSide: SMS2Side;
  myId: string;
}

export default function ScorePanel({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[p1, p2]
        .sort((a, b) => Number(b.id === myId) - Number(a.id === myId))
        .map((p) => {
          const isMe = p.id === myId;
          const isFirst = p.side === firstSide;
          const range = powderStageRange(p.powderStage);
          return (
            <div
              key={p.side}
              className={`flex flex-col gap-1 rounded-xl border-2 p-2 ${
                isMe ? 'border-indigo-200 bg-indigo-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`min-w-0 truncate text-sm font-semibold ${
                    isMe ? 'text-indigo-700' : 'text-amber-700'
                  }`}
                >
                  {isMe ? '나' : p.nickname}
                  {isFirst && <span className="ml-1 text-amber-500">👑선</span>}
                </span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <span
                  className={`text-lg font-extrabold tabular-nums ${
                    isMe ? 'text-purple-700' : 'text-purple-600'
                  }`}
                >
                  🪙{p.chips}
                </span>
                <span className="text-right text-[11px] text-gray-500">
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
