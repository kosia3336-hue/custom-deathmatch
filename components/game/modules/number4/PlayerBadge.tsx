'use client';

import type { NF4PlayerInfo } from '@/shared/types/number4';

interface PlayerBadgeProps {
  player: NF4PlayerInfo;
  isMe: boolean;
  timerRemaining: number | null;
}

export default function PlayerBadge({ player, isMe, timerRemaining }: PlayerBadgeProps) {
  const scoreColor = player.score <= 1 ? 'text-red-500' : 'text-gray-900';

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
      <span className="font-medium truncate max-w-[80px]">{player.nickname}</span>
      <span className={`font-bold ${scoreColor}`}>{player.score}점</span>
      {timerRemaining !== null && timerRemaining >= 0 && (
        <span className={`text-xs font-mono ${timerRemaining <= 10 ? 'text-red-500 animate-pulse' : timerRemaining <= 30 ? 'text-yellow-500' : 'text-gray-400'}`}>
          {Math.ceil(timerRemaining)}s
        </span>
      )}
    </div>
  );
}
