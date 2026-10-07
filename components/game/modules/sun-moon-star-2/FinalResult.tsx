'use client';

import type { SMS2GameData, SMS2PlayerPublic, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { WIN_TYPE_LABELS } from './constants';

/* ════════════════════════════════════════════════════════════
 * FinalResult — 게임 종료 결과 카드
 * 모바일/데스크탑 공유
 * ════════════════════════════════════════════════════════════ */

interface Props {
  finalWinner: SMS2Side | 'draw' | null;
  winType: SMS2GameData['winType'];
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
  myId: string;
}

export default function FinalResult({ finalWinner, winType, players, myId }: Props) {
  const winnerLabel =
    finalWinner === 'draw'
      ? '무승부!'
      : finalWinner
        ? `${players[finalWinner].id === myId ? '나' : players[finalWinner].nickname} 승리!`
        : '게임 종료';
  const reason = winType ? ((WIN_TYPE_LABELS as Record<string, string>)[winType] ?? '') : '';
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-indigo-300 bg-linear-to-br from-indigo-50 via-violet-50 to-fuchsia-50 p-5 text-center shadow-lg">
      <p className="text-xl font-bold text-indigo-900">{winnerLabel}</p>
      {reason && <p className="text-xs text-indigo-600">{reason}</p>}
      <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
        {(['p1', 'p2'] as const).map((s) => {
          const p = players[s];
          const isWinner = finalWinner === s;
          return (
            <div
              key={s}
              className={`rounded-lg border p-2 ${
                isWinner
                  ? 'border-emerald-300 bg-emerald-50 shadow-[0_0_8px_rgba(52,211,153,0.25)]'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="truncate text-[11px] text-gray-500">
                {p.id === myId ? '나' : p.nickname}
              </div>
              <div className="text-base font-bold text-purple-700 tabular-nums">칩 {p.chips}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
