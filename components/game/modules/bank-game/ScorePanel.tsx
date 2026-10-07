'use client';

import { BANK_TOTAL_ROUNDS, type BankPlayerInfo, type BankSide } from '@/shared/types/bank-game';
import { formatKRW } from './constants';

/* 승점 칸 수 = 도달 가능한 최대 점수. 근거는 ScoreBar.tsx 주석 참고. */
const WIN_SCORE = Math.floor(BANK_TOTAL_ROUNDS / 2) + 1;

interface Props {
  p1: BankPlayerInfo;
  p2: BankPlayerInfo;
  firstSide: BankSide;
  myId: string | null;
}

export default function ScorePanel({ p1, p2, firstSide, myId }: Props) {
  return (
    <div className="bank-score-panel grid grid-cols-2 gap-2">
      <p className="bank-sidebar-heading col-span-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        점수 · 잔여
      </p>
      {[p1, p2]
        .sort((a, b) => Number(b.id === myId) - Number(a.id === myId))
        .map((p) => {
          const isMe = !!myId && p.id === myId;
          const isFirst = p.side === firstSide;
          return (
            <div
              key={p.side}
              className={`bank-score-card bank-score-card--${isMe ? 'player' : 'opponent'} flex flex-col gap-1 rounded-xl border-2 p-2 ${
                isMe ? 'border-indigo-200 bg-indigo-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`bank-score-emblem bank-score-emblem--${isMe ? 'player' : 'opponent'}`}
                  aria-hidden
                />
                <span
                  className={`min-w-0 truncate text-sm font-semibold ${
                    isMe ? 'text-indigo-700' : 'text-amber-700'
                  }`}
                >
                  {isMe ? '나' : p.nickname}
                  {isFirst && <span className="ml-1 text-amber-500">선</span>}
                </span>
                <span
                  className={`text-xl font-extrabold tabular-nums ${
                    isMe ? 'text-indigo-700' : 'text-amber-700'
                  }`}
                >
                  {p.score}점
                </span>
              </div>
              <div
                className="bank-score-track grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${WIN_SCORE}, minmax(0, 1fr))` }}
                aria-hidden
              >
                {Array.from({ length: WIN_SCORE }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 rounded-sm ${
                      i < p.score ? (isMe ? 'bg-indigo-500' : 'bg-amber-500') : 'bg-white'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-white/60 pt-1.5">
                <span className="text-[11px] tracking-wide text-gray-500 uppercase">잔여 자원</span>
                <span className="text-right">
                  <span className="block text-xs font-bold text-gray-700 tabular-nums">
                    {p.inventoryCount}장
                  </span>
                  <span className="block text-[11px] text-gray-400 tabular-nums">
                    {p.inventoryAmount != null ? `${formatKRW(p.inventoryAmount)}원` : '비공개'}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
