'use client';

import type { BankPlayerInfo, BankSide } from '@/shared/types/bank-game';
import { formatKRW } from './constants';

const TOTAL_ROUNDS = 9;

interface Props {
  p1: BankPlayerInfo;
  p2: BankPlayerInfo;
  firstSide: BankSide;
  myId: string | null;
}

export default function ScoreBar({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
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
      className={`flex min-w-0 items-center gap-2 px-3 py-1.5 ${tone} ${
        isFirstRow ? 'border-b border-white' : ''
      }`}
    >
      <span className={`min-w-0 max-w-20 shrink-0 truncate text-xs font-bold ${accent}`}>
        {nickname}
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-9 gap-0.5" aria-hidden>
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-sm ${i < score ? cellWon : cellDim}`}
          />
        ))}
      </div>
      <span className={`shrink-0 text-sm font-extrabold tabular-nums ${accent}`}>
        {score}점
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
        {inventoryCount}장
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
        {inventoryAmount != null ? `${formatKRW(inventoryAmount)}원` : ''}
      </span>
    </div>
  );
}
