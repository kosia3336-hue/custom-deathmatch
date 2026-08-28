'use client';

import type { BankGameData, BankPlayerInfo, BankSide } from '@/shared/types/bank-game';
import { WIN_TYPE_LABELS, formatKRW } from './constants';

/* ════════════════════════════════════════════════════════════
 * FinalResult — 게임 종료 결과 카드
 *   · sms2 패턴: 큰 트로피 + 우승자 라벨 + 2-up 그리드
 *   · 우승자 카드 emerald 강조
 *   · 기록실 안내 한 줄
 * ════════════════════════════════════════════════════════════ */

interface Props {
  finalWinner: BankSide | 'draw' | null;
  winType: BankGameData['winType'];
  players: { p1: BankPlayerInfo; p2: BankPlayerInfo };
  myId: string | null;
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
    <div className="bank-final-result flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-indigo-300 bg-linear-to-br from-indigo-50 via-violet-50 to-fuchsia-50 p-5 text-center shadow-lg">
      <p className="text-xl font-bold text-indigo-900">{winnerLabel}</p>
      <p className="text-sm text-indigo-700 tabular-nums">
        최종 {players.p1.score} - {players.p2.score}
      </p>
      {reason && <p className="text-xs text-indigo-600">{reason}</p>}

      <div className="mt-2 grid w-full grid-cols-2 gap-3 text-sm">
        {(['p1', 'p2'] as const).map((s) => {
          const p = players[s];
          const isWinner = finalWinner === s;
          const isMe = p.id === myId;
          return (
            <div
              key={s}
              className={`bank-final-player bank-score-card--${isMe ? 'player' : 'opponent'} rounded-lg border-2 p-3 text-left ${
                isWinner
                  ? 'border-emerald-400 bg-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.35)]'
                  : isMe
                    ? 'border-indigo-200 bg-white'
                    : 'border-amber-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-bold text-gray-700">
                  {isMe ? '나' : p.nickname}
                </span>
                <span className="text-xl font-extrabold text-gray-800 tabular-nums">
                  {p.score}점
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-gray-500">잔여</span>
                <span className="text-right">
                  <span className="block font-bold text-gray-700 tabular-nums">
                    {p.inventoryCount}장
                  </span>
                  {p.inventoryAmount != null && (
                    <span className="block text-[10px] text-gray-500 tabular-nums">
                      {formatKRW(p.inventoryAmount)}원
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-indigo-600">
        기록실에서 모든 라운드의 승자 금액·상대 인벤토리를 확인하세요
      </p>
    </div>
  );
}
