'use client';

import { BANK_TOTAL_ROUNDS, type BankPlayerInfo, type BankSide } from '@/shared/types/bank-game';
import { formatKRW } from './constants';

/*
  승점 칸 수 = 실제로 도달할 수 있는 최대 점수.

  9라운드를 다 치르는 게임이 아니라, '점수 > 상대 + 남은 라운드' 가 되는 순간
  끝난다(server state.ts checkEarlyWin). 그래서 9라운드 기준으로는 5점이 상한이고
  5점을 채우면 남은 라운드와 무관하게 이긴다. 칸을 9개 두면 절대 채워지지 않는
  칸이 4개 남아 진행도가 실제보다 덜 찬 것처럼 보였다.
*/
const WIN_SCORE = Math.floor(BANK_TOTAL_ROUNDS / 2) + 1;

interface Props {
  p1: BankPlayerInfo;
  p2: BankPlayerInfo;
  firstSide: BankSide;
  myId: string | null;
}

export default function ScoreBar({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="bank-score-bar overflow-hidden rounded-xl border border-gray-200 bg-white">
      {([p1, p2] as const).map((p, i) => {
        const isMe = !!myId && p.id === myId;
        const isFirst = p.side === firstSide;
        return (
          <ScoreRow
            key={p.side}
            isMe={isMe}
            isFirst={isFirst}
            nickname={isMe ? '나' : p.nickname}
            score={p.score}
            inventoryCount={p.inventoryCount}
            inventoryAmount={p.inventoryAmount}
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
  score,
  inventoryCount,
  inventoryAmount,
  isFirstRow,
}: {
  isMe: boolean;
  isFirst: boolean;
  nickname: string;
  score: number;
  inventoryCount: number;
  inventoryAmount: number | null;
  isFirstRow: boolean;
}) {
  const tone = isMe ? 'bg-indigo-50' : 'bg-amber-50';
  const accent = isMe ? 'text-indigo-700' : 'text-amber-700';
  const cellWon = isMe ? 'bg-indigo-500' : 'bg-amber-500';
  const cellDim = 'bg-gray-200';

  return (
    <div
      className={`bank-score-row bank-score-card--${isMe ? 'player' : 'opponent'} flex min-w-0 items-center gap-2 px-3 py-1.5 ${tone} ${
        isFirstRow ? 'border-b border-white' : ''
      }`}
    >
      <span
        className={`bank-score-emblem bank-score-emblem--${isMe ? 'player' : 'opponent'}`}
        aria-hidden
      />
      <span className={`max-w-20 min-w-0 shrink-0 truncate text-xs font-bold ${accent}`}>
        {nickname}
      </span>
      <div
        className="bank-score-track grid min-w-0 flex-1 gap-0.5"
        style={{ gridTemplateColumns: `repeat(${WIN_SCORE}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: WIN_SCORE }).map((_, i) => (
          <span key={i} className={`h-1.5 rounded-sm ${i < score ? cellWon : cellDim}`} />
        ))}
      </div>
      <span className={`shrink-0 text-sm font-extrabold tabular-nums ${accent}`}>{score}점</span>
      <span className="shrink-0 text-[10px] text-gray-500 tabular-nums">{inventoryCount}장</span>
      <span className="shrink-0 text-[10px] text-gray-500 tabular-nums">
        {inventoryAmount != null ? `${formatKRW(inventoryAmount)}원` : ''}
      </span>
    </div>
  );
}
