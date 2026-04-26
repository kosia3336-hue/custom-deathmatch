'use client';

import type { SMS2PlayerPublic, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';

/* ════════════════════════════════════════════════════════════
 * ScoreBar — 모바일 전용 한 줄 양측 점수+단계바
 *   · 본인 indigo, 상대 amber 양분
 *   · 5칸 미니 단계바 + 단계 텍스트 + 칩
 *   · 풀 PowderTrack 의 약 1/4 높이로 압축
 * ════════════════════════════════════════════════════════════ */

interface Props {
  p1: SMS2PlayerPublic;
  p2: SMS2PlayerPublic;
  firstSide: SMS2Side;
  myId: string;
}

export default function ScoreBar({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {([p1, p2] as const).map((p, i) => {
        const isMe = p.id === myId;
        const isFirst = p.side === firstSide;
        const range = powderStageRange(p.powderStage);
        return (
          <ScoreRow
            key={p.side}
            isMe={isMe}
            isFirst={isFirst}
            nickname={isMe ? '나' : p.nickname}
            stage={p.powderStage}
            stageMin={range.min}
            stageMax={range.max}
            chips={p.chips}
            isFirstRow={i === 0}
          />
        );
      })}
    </div>
  );
}

function ScoreRow({
  isMe,
  isFirst,
  nickname,
  stage,
  stageMin,
  stageMax,
  chips,
  isFirstRow,
}: {
  isMe: boolean;
  isFirst: boolean;
  nickname: string;
  stage: number;
  stageMin: number;
  stageMax: number;
  chips: number;
  isFirstRow: boolean;
}) {
  const tone = isMe ? 'bg-indigo-50' : 'bg-amber-50';
  const accent = isMe ? 'text-indigo-700' : 'text-amber-700';
  const cellActive = isMe ? 'bg-indigo-500' : 'bg-amber-500';
  const cellLit = isMe ? 'bg-indigo-200' : 'bg-amber-200';
  const cellDim = 'bg-gray-200';

  return (
    <div
      className={`flex min-w-0 items-center gap-2 px-3 py-1.5 ${tone} ${
        isFirstRow ? 'border-b border-white' : ''
      }`}
    >
      <span className={`min-w-0 max-w-20 shrink-0 truncate text-xs font-bold ${accent}`}>
        {nickname}
        {isFirst && <span className="ml-0.5 text-[10px] text-amber-500">👑</span>}
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-5 gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            className={`h-2 rounded-sm ${
              s < stage ? cellLit : s === stage ? cellActive : cellDim
            }`}
          />
        ))}
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
        {stage}단 {stageMin}~{stageMax}g
      </span>
      <span className={`shrink-0 text-sm font-extrabold tabular-nums ${accent}`}>
        🪙{chips}
      </span>
    </div>
  );
}
