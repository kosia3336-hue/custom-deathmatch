'use client';
import type { BNW2PlayerInfo, BNW2RevealData } from '@/shared/types/bnw2';
import { ColorBadge } from './ColorBadge';

export function RevealPanel({
  revealData,
  players,
  myId,
  firstPlayerId,
  step,
}: {
  revealData: BNW2RevealData;
  players: Record<string, BNW2PlayerInfo>;
  myId: string;
  firstPlayerId: string;
  step: number;
}) {
  const entries = Object.entries(revealData.players);
  const winnerId = revealData.winnerId;
  const firstEntry = entries.find(([id]) => id === firstPlayerId);
  const secondEntry = entries.find(([id]) => id !== firstPlayerId);
  const ordered = [firstEntry, secondEntry].filter(Boolean) as [
    string,
    (typeof revealData.players)[string],
  ][];

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-center text-sm font-semibold text-gray-700">라운드 결과</p>

      <div className="grid grid-cols-2 gap-3">
        {ordered.map(([pid, pd], idx) => {
          const pInfo = players[pid];
          const isMe = pid === myId;

          const isWinner = pid === winnerId;
          const colorVisible = idx === 0 ? step >= 1 : step >= 2;
          const winnerVisible = step >= 3;
          const scoreVisible = step >= 4;

          return (
            <div
              key={pid}
              className={`rounded-xl border p-3 text-center transition-all duration-300 ${
                winnerVisible && isWinner
                  ? 'border-emerald-300 bg-emerald-50 shadow-[0_0_8px_rgba(52,211,153,0.2)]'
                  : winnerVisible && winnerId !== null
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : winnerId === null && winnerVisible
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
              }`}
            >
              <p className="truncate text-xs font-medium text-gray-500">
                {isMe ? '나' : (pInfo?.nickname ?? pid)}
              </p>
              <div className="my-2 flex justify-center">
                <ColorBadge color={pd.color} visible={colorVisible} />
              </div>
              {colorVisible && (
                <p className="text-xs font-medium text-indigo-500">
                  {pd.stageBefore - Math.max(pd.stageAfter, 1) > 0
                    ? `불이 ${pd.stageBefore - Math.max(pd.stageAfter, 1)}칸 꺼집니다.`
                    : '불이 꺼지지 않습니다.'}
                </p>
              )}
              {winnerVisible && pd.scoreChange > 0 && (
                <p
                  className={`text-xs font-semibold text-emerald-600 ${scoreVisible ? 'animate-[floatUp_500ms_ease-out_forwards]' : ''}`}
                >
                  +{pd.scoreChange}점
                </p>
              )}
              {winnerVisible && (
                <p className="text-xs text-gray-400">
                  {pd.scoreBefore} → {pd.scoreAfter}점
                </p>
              )}
            </div>
          );
        })}
      </div>

      {step >= 3 && winnerId === null && (
        <p className="text-center text-sm font-semibold text-amber-500">무승부</p>
      )}
    </div>
  );
}
