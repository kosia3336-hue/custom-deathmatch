'use client';

import type { IPPlayerInfo } from '@/shared/types/indian-poker';

interface PlayerAreaProps {
  player: IPPlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
  timerRemaining: number | null;
}

/*
  사이드 패널의 '플레이어'(짙은 잉크 칸) 안에서만 쓴다. 예전에는 카드 바탕을
  흰색으로 고정해 두고 닉네임은 색을 안 줘 잉크 칸의 밝은 글자색을 물려받아,
  흰 카드 위 흰 닉네임이 되어 보이지 않았다. 카드도 잉크 톤으로 맞춘다.
*/
export default function PlayerArea({ player, isMe, isCurrentTurn, timerRemaining }: PlayerAreaProps) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      isCurrentTurn
        ? 'border-amber-400 bg-amber-400/15 ring-1 ring-amber-400/40'
        : isMe ? 'border-cdm-primary bg-cdm-primary/20' : 'border-cdm-ink-border bg-white/5'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-cdm-ink-fg truncate text-sm font-semibold lg:text-base">{player.nickname}</span>
          {isMe && <span className="text-[10px] font-medium text-indigo-300 lg:text-xs">(나)</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-sm font-bold text-cdm-ink-fg lg:text-base">{player.chips}</span>
          {player.roundBet > 0 && (
            <span className="text-xs text-cdm-ink-fg-muted lg:text-sm">베팅: {player.roundBet}</span>
          )}
        </div>
      </div>
      {isCurrentTurn && timerRemaining !== null && timerRemaining >= 0 && (
        <span className={`font-mono text-xs tabular-nums lg:text-sm ${
          timerRemaining <= 10 ? 'animate-pulse text-red-400' : timerRemaining <= 30 ? 'text-yellow-300' : 'text-cdm-ink-fg-muted'
        }`}>
          ⏱{Math.ceil(timerRemaining)}s
        </span>
      )}
    </div>
  );
}
