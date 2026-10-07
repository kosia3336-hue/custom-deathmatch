'use client';
import { FT_MAX_SCORE } from '@/shared/types';
import type { FTPlayerInfo } from '@/shared/types/five-towers';
import { labelOfItem } from './labelOfItem';

export function ScoreCard({
  player,
  isMe,
  isCurrentTurn,
}: {
  player: FTPlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border-2 p-3 transition-all ${
        isCurrentTurn ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between text-xs font-medium text-gray-500">
        <span>{isMe ? '나' : '상대'}</span>
        {isCurrentTurn && (
          /* '나' 옆에 '차례' 만 붙이면 '나 차례' 로 읽힌다. 배지가 스스로 말하게 둔다. */
          <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            {isMe ? '내 차례' : '상대 차례'}
          </span>
        )}
      </div>
      <div className="truncate text-sm font-semibold text-gray-800">{player.nickname}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {Array.from({ length: FT_MAX_SCORE }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${
                i < player.score ? 'bg-amber-400' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xl font-black text-gray-800 tabular-nums">
          {player.score}
          <span className="ml-0.5 text-xs font-normal text-gray-400">/{FT_MAX_SCORE}</span>
        </span>
      </div>
      {isMe && player.itemUsed && (
        <div className="mt-0.5 text-[11px] font-medium text-gray-400">
          아이템 사용함{player.myItemUsedKind ? ` (${labelOfItem(player.myItemUsedKind)})` : ''}
        </div>
      )}
    </div>
  );
}
