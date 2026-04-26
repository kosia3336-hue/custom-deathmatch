'use client';

import { useEffect, useState } from 'react';
import type { SMS2ChipBet, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, secondMinBet, sumBet } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';

/* ════════════════════════════════════════════════════════════
 * FirstBetRevealBanner
 *   betSecond 페이즈에서 "선이 어디에 얼마를 걸었는지"를
 *   크고 명확하게 보여주는 배너. (BetInput 내부 미니카드 대체)
 *   · 등장 시 살짝 펄스 → 정상 표시
 *   · 후 베팅 최소액(2배) 강조
 *   · resolve/roundEnd 진입 시 부모에서 언마운트 → 자연 페이드
 * ════════════════════════════════════════════════════════════ */

interface Props {
  firstBet: SMS2ChipBet;
  firstSide: SMS2Side;
  firstNick: string;
  /** 본인이 후 베팅 차례인지 (메시지/하이라이트 결정) */
  isMyTurn: boolean;
}

export default function FirstBetRevealBanner({
  firstBet,
  firstNick,
  isMyTurn,
}: Props) {
  const total = sumBet(firstBet);
  const minSecond = secondMinBet(total);
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-2 rounded-2xl border-2 p-3 shadow-md transition-shadow lg:p-4 ${
        isMyTurn
          ? 'border-amber-300 bg-linear-to-br from-amber-50 to-orange-100/70'
          : 'border-amber-200 bg-amber-50'
      } ${pulse ? 'animate-[sms2BannerPop_0.6s_ease-out]' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">👑</span>
          <p className="text-xs font-bold text-amber-700 lg:text-sm">
            {firstNick} (선) 베팅 공개
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-amber-600 lg:text-[11px]">총 베팅</p>
          <p className="text-xl font-extrabold tabular-nums text-amber-700 lg:text-2xl">
            {total}
            <span className="ml-0.5 text-xs font-bold">칩</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MARK_IDS.map((m) => {
          const s = MARK_STYLES[m];
          const v = firstBet[m];
          const placed = v > 0;
          return (
            <div
              key={m}
              className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 ${
                placed
                  ? `${s.borderLit} ${s.bgLit}`
                  : 'border-amber-200/70 bg-white/70'
              }`}
            >
              <span className="text-lg lg:text-xl">{s.icon}</span>
              <span
                className={`text-base font-bold tabular-nums lg:text-lg ${
                  placed ? s.textLit : 'text-gray-400'
                }`}
              >
                {v}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-0.5 rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold lg:text-xs ${
          isMyTurn
            ? 'bg-amber-200/80 text-amber-900'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        {isMyTurn ? '내가 후 베팅' : '후 베팅 최소'}{' '}
        <span className="text-base font-extrabold tabular-nums lg:text-lg">
          {minSecond}
        </span>
        <span className="text-[10px] font-bold lg:text-[11px]"> 칩 이상</span>
        {total > 0 && (
          <span className="ml-1 text-[10px] font-medium opacity-75">
            (선 ×2)
          </span>
        )}
      </div>
    </div>
  );
}
