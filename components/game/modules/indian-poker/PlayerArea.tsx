'use client';

import type { IPPlayerInfo } from '@/shared/types/indian-poker';

interface PlayerAreaProps {
  player: IPPlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
}

export default function PlayerArea({ player, isMe, isCurrentTurn }: PlayerAreaProps) {
  return (
    <div
      className={`text-cdm-fg min-w-0 rounded-lg border px-2 py-1.5 transition-colors sm:px-3 ${
        isCurrentTurn
          ? 'border-cdm-primary bg-cdm-primary/10'
          : 'border-cdm-border bg-cdm-bg-elev-1'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1 font-semibold">
            <span className="min-w-0 truncate" title={player.nickname}>
              {player.nickname}
            </span>
            {isMe && <span className="shrink-0 text-[11px]">(나)</span>}
          </span>
          <strong className="shrink-0 tabular-nums">{player.chips}칩</strong>
        </div>
        <div className="text-cdm-fg-muted mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-[11px]">
          <span>
            베팅 <strong className="tabular-nums">{player.roundBet}</strong>
          </span>
          {isCurrentTurn && <span className="text-cdm-primary font-semibold">베팅 중</span>}
        </div>
      </div>
    </div>
  );
}
