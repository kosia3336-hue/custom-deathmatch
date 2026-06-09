'use client';

import type { SmsRoundScorer } from '@/shared/types/sun-moon-star-event';

interface Props {
  scorers: SmsRoundScorer[];
}

export default function SmsRoundScoreList({ scorers }: Props) {
  const gainers = scorers.filter((s) => s.roundScore > 0);
  const penalized = scorers.filter((s) => s.roundScore === -1);
  const neutral = scorers.every((s) => s.roundScore <= 0);

  return (
    <div className="mt-3 space-y-2 text-sm text-left">
      {gainers.length > 0 && (
        <ul className="space-y-1">
          {gainers.map((s) => (
            <li key={s.seatIdx}>
              {s.nickname}{' '}
              <strong className="text-amber-600">+{s.roundScore}</strong>
              {s.roundScore === 3 && (
                <span className="text-xs text-cdm-muted"> (전환 보너스)</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {penalized.length > 0 && (
        <ul className="space-y-1 border-t border-cdm-border pt-2">
          {penalized.map((s) => (
            <li key={s.seatIdx} className="text-rose-700">
              {s.nickname}{' '}
              <strong>-1</strong>
              <span className="text-xs text-cdm-muted"> (표식 변경 실패)</span>
            </li>
          ))}
        </ul>
      )}
      {neutral && penalized.length === 0 && (
        <p className="text-center text-cdm-muted">점수 변동 없음</p>
      )}
    </div>
  );
}
