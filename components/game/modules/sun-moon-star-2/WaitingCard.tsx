'use client';

import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type { SMS2GameData, SMS2PlayerPublic } from '@/shared/types/sun-moon-star-2';

/* ════════════════════════════════════════════════════════════
 * WaitingCard — "상대가 X 중…" 카드
 *   · 모바일/데스크탑 공유
 *   · phase + 본인 상태 → 안내 문구 자동 결정
 * ════════════════════════════════════════════════════════════ */

interface Props {
  text: string;
}

export default function WaitingCard({ text }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-5">
      <span className="inline-flex items-center gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
      </span>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export function buildWaitingText({
  phase,
  isSpectator,
  firstPlayer,
  secondPlayer,
  mySubmittedPowder,
}: {
  phase: SMS2GameData['phase'] | null;
  isSpectator: boolean;
  firstPlayer: SMS2PlayerPublic;
  secondPlayer: SMS2PlayerPublic;
  mySubmittedPowder: boolean;
}): string {
  if (phase === 'powder') {
    if (isSpectator) return '양측 빛가루 분배 중...';
    if (mySubmittedPowder) return '상대가 분배 중...';
    return '빛가루 분배 대기';
  }
  if (phase === 'betFirst')
    return `${opponentDisplayName(firstPlayer.nickname, isSpectator)} (선)이 베팅 중...`;
  if (phase === 'betSecond')
    return `${opponentDisplayName(secondPlayer.nickname, isSpectator)} (후)가 베팅 중...`;
  return '대기 중...';
}
