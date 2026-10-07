'use client';
import type { WSPlayerInfo } from '@/shared/types/winning-streak';

export function StatLine({
  player,
  label,
  isMe,
}: {
  player: WSPlayerInfo;
  label: string;
  isMe: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border px-2.5 py-1.5 ${
        isMe ? 'border-cdm-primary/50 bg-cdm-primary/15' : 'border-cdm-ink-border bg-white/5'
      }`}
    >
      <span className="text-cdm-ink-fg min-w-0 truncate text-xs font-bold">{player.nickname}</span>
      <span className="text-cdm-ink-fg-muted shrink-0 text-[11px]">{label}</span>
      <span className="text-cdm-ink-fg w-full text-[11px] font-bold whitespace-nowrap tabular-nums">
        {player.currentStreak}연승 · 최대 {player.maxStreak} · {player.totalWins}승
      </span>
    </div>
  );
}
