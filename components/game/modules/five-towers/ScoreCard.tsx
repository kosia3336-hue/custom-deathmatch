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
      data-score-row
      className={`flex flex-col gap-1 rounded-xl border-2 p-3 transition-all ${
        isCurrentTurn
          ? 'border-cdm-primary bg-cdm-primary-soft shadow-sm'
          : 'border-cdm-border bg-cdm-bg'
      }`}
    >
      <div className="text-cdm-fg-muted flex items-center justify-between text-xs font-medium">
        <span>{isMe ? '나' : '상대'}</span>
        {isCurrentTurn && (
          /* '나' 옆에 '차례' 만 붙이면 '나 차례' 로 읽힌다. 배지가 스스로 말하게 둔다. */
          <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            {isMe ? '내 차례' : '상대 차례'}
          </span>
        )}
      </div>
      <div className="text-cdm-fg truncate text-sm font-semibold">{player.nickname}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {Array.from({ length: FT_MAX_SCORE }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${
                i < player.score ? 'bg-amber-400' : 'bg-cdm-bg-elev-2'
              }`}
            />
          ))}
        </div>
        <span className="text-cdm-fg text-xl font-black tabular-nums">
          {player.score}
          <span className="text-cdm-fg-subtle ml-0.5 text-xs font-normal">/{FT_MAX_SCORE}</span>
        </span>
      </div>
      {isMe && player.itemUsed && (
        <div className="text-cdm-fg-subtle mt-0.5 text-[11px] font-medium">
          아이템 사용함{player.myItemUsedKind ? ` (${labelOfItem(player.myItemUsedKind)})` : ''}
        </div>
      )}
    </div>
  );
}
