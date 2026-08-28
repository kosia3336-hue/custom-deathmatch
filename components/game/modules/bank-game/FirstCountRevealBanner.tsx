'use client';

import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════
 * FirstCountRevealBanner — 선의 장수 공개 (금액은 비공개)
 *   · firstReveal / secondSubmit 페이즈에 메인 영역 위쪽 표시
 *   · 등장 시 bankBannerPop 0.6s 펄스
 * ════════════════════════════════════════════════════════════ */

interface Props {
  firstNick: string;
  firstBetCount: number;
  /** 본인이 후 베팅 차례인지 */
  isMyTurn: boolean;
}

export default function FirstCountRevealBanner({ firstNick, firstBetCount, isMyTurn }: Props) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bank-reveal-banner flex items-center justify-between gap-3 rounded-2xl border-2 p-3 shadow-md transition-shadow lg:p-4 ${
        isMyTurn
          ? 'border-amber-300 bg-linear-to-br from-amber-50 to-orange-100/70'
          : 'border-amber-200 bg-amber-50'
      } ${pulse ? 'animate-[bankBannerPop_0.6s_ease-out]' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-amber-700 lg:text-sm">
            {firstNick} (선) 제출 완료
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] tracking-wide text-amber-600 uppercase">제출 장수</p>
        <p className="text-3xl font-extrabold text-amber-700 tabular-nums lg:text-4xl">
          {firstBetCount}
          <span className="ml-0.5 text-sm font-bold">장</span>
        </p>
      </div>
    </div>
  );
}
