'use client';

import type { IPPlayerInfo } from '@/shared/types/indian-poker';

interface PlayerAreaProps {
  player: IPPlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
  timerRemaining: number | null;
}

export default function PlayerArea({ player, isMe, isCurrentTurn, timerRemaining }: PlayerAreaProps) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      isCurrentTurn
        ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
        : isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold lg:text-base">{player.nickname}</span>
          {isMe && <span className="text-[10px] font-medium text-indigo-500 lg:text-xs">(나)</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-sm font-bold text-gray-900 lg:text-base">🪙 {player.chips}</span>
          {player.roundBet > 0 && (
            <span className="text-xs text-gray-500 lg:text-sm">베팅: {player.roundBet}</span>
          )}
        </div>
      </div>
      {isCurrentTurn && timerRemaining !== null && timerRemaining >= 0 && (
        <span className={`font-mono text-xs tabular-nums lg:text-sm ${
          timerRemaining <= 10 ? 'animate-pulse text-red-500' : timerRemaining <= 30 ? 'text-yellow-500' : 'text-gray-400'
        }`}>
          ⏱{Math.ceil(timerRemaining)}s
        </span>
      )}
    </div>
  );
}
