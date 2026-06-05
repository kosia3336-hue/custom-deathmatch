'use client';

import type { SmsGameData } from '@/shared/types/sun-moon-star-event';

interface Props {
  gameData: SmsGameData;
}

export default function SmsRevealBanner({ gameData: gd }: Props) {
  if (gd.phase !== 'revealFirst' && gd.phase !== 'revealSecond') return null;

  const seatIdx = gd.revealSeatIdx;
  if (seatIdx == null) return null;

  const seat = gd.seats[seatIdx];
  const which = gd.revealPhase === 'first' ? '1차' : '2차';
  const nickname = seat?.nickname ?? `좌석 ${seatIdx + 1}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-lg animate-[smsEvtBannerPop_0.5s_ease-out] rounded-xl border-2 border-indigo-200 bg-indigo-50/90 px-4 py-2.5 text-center shadow-sm"
    >
      <p className="text-sm font-bold text-indigo-800">
        {nickname}님의 {which} 선택
      </p>
    </div>
  );
}
