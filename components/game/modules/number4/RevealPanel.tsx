'use client';

import type { NF4RevealData, NF4PlayerInfo, NF4WinType } from '@/shared/types/number4';
import { NUMBER_INFO, WIN_TYPE_LABELS } from './constants';

interface RevealPanelProps {
  revealData: NF4RevealData;
  players: Record<string, NF4PlayerInfo>;
  round: number;
  winner: string | null;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
}

export default function RevealPanel({ revealData, players, round, winner, winType, tiebreakerReason }: RevealPanelProps) {
  const playerEntries = Object.entries(players);
  const isFinished = !!winner;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
      <div className="text-center text-sm font-semibold text-gray-600">
        라운드 {round} — 결과
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {playerEntries.map(([pid, player]) => {
          const reveal = revealData.players[pid];
          if (!reveal) return null;

          const numInfo = NUMBER_INFO.find((n) => n.number === reveal.number);

          return (
            <div key={pid} className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-700 truncate">{player.nickname}</div>

              {/* 넘버 */}
              <div className="flex items-center gap-2">
                <span
                  className="text-lg font-bold"
                  style={{ color: numInfo?.color }}
                >
                  넘버 {reveal.number}
                </span>
              </div>

              {/* 조건 상세 */}
              <div className="text-xs text-gray-500">{reveal.conditionDetail}</div>

              {/* 결과 */}
              <div className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold ${
                reveal.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                <span>{reveal.success ? '✅' : '❌'}</span>
                <span>{reveal.success ? `+${reveal.scoreChange}점` : `${reveal.scoreChange}점`}</span>
              </div>

              {/* 승점 */}
              <div className="text-sm font-bold">
                {player.score}점
              </div>
            </div>
          );
        })}
      </div>

      {isFinished && winType && (
        <div className="mt-2 rounded-lg bg-indigo-50 p-3 text-center">
          <div className="text-sm font-semibold text-indigo-700">
            {WIN_TYPE_LABELS[winType]}
          </div>
          {tiebreakerReason && (
            <div className="mt-1 text-xs text-indigo-500">{tiebreakerReason}</div>
          )}
        </div>
      )}

      {!isFinished && (
        <div className="text-center text-xs text-gray-400 animate-pulse">
          다음 라운드로 이동 중...
        </div>
      )}
    </div>
  );
}
