'use client';

import type { IPShowdownData, IPDieData, IPPlayerInfo, IPWinType } from '@/shared/types/indian-poker';
import { HAND_LABELS, HAND_COLORS, WIN_TYPE_LABELS } from './constants';

interface HandResultProps {
  showdownData: IPShowdownData | null;
  dieData: IPDieData | null;
  players: Record<string, IPPlayerInfo>;
  winner: string | null;
  winType: IPWinType | null;
}

export default function HandResult({ showdownData, dieData, players, winner, winType }: HandResultProps) {
  if (showdownData) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="text-center text-sm font-semibold text-gray-600">
          {showdownData.isDraw ? '무승부!' : '쇼다운 결과'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(showdownData.players).map(([pid, data]) => {
            const p = players[pid];
            const isWinner = pid === showdownData.winnerId;
            return (
              <div key={pid} className={`flex flex-col items-center gap-1 rounded-lg border p-3 ${
                isWinner ? 'border-green-300 bg-green-50' : showdownData.isDraw ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'
              }`}>
                <span className="text-xs text-gray-500 truncate">{p?.nickname}</span>
                <span className="text-lg font-bold">{data.card}</span>
                <span className="text-sm font-semibold" style={{ color: HAND_COLORS[data.hand] }}>
                  {HAND_LABELS[data.hand]}
                </span>
                <span className={`text-sm font-bold ${data.chipChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {data.chipChange > 0 ? `+${data.chipChange}` : data.chipChange}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (dieData) {
    const diedP = players[dieData.diedPlayerId];
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="text-center text-sm font-semibold text-red-600">
          {diedP?.nickname} 다이!
        </div>
        <div className="flex flex-col items-center gap-1 text-sm">
          <span>카드: <strong>{dieData.diedCard}</strong></span>
          <span style={{ color: HAND_COLORS[dieData.diedHand] }}>
            {HAND_LABELS[dieData.diedHand]}
          </span>
          {dieData.penalty > 0 && (
            <span className="text-red-500 font-medium">패널티: -{dieData.penalty}칩</span>
          )}
        </div>
        <div className="flex justify-center gap-4 text-xs text-gray-500">
          {Object.entries(dieData.chipChanges).map(([pid, change]) => (
            <span key={pid}>
              {players[pid]?.nickname}: <strong className={change >= 0 ? 'text-green-600' : 'text-red-500'}>
                {change > 0 ? `+${change}` : change}
              </strong>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (winner && winType) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
        <div className="text-sm font-semibold text-indigo-700">
          {WIN_TYPE_LABELS[winType]}
        </div>
      </div>
    );
  }

  return null;
}
