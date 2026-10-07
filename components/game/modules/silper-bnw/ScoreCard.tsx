'use client';
import type { SBNWPlayerInfo } from '@/shared/types/silper-bnw';

export function ScoreCard({
  info,
  isMe,
  isFirst,
}: {
  info: SBNWPlayerInfo;
  isMe: boolean;
  isFirst: boolean;
}) {
  const dots = Array.from({ length: 6 }, (_, i) => i < info.score);
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2 ${
        isMe ? 'border-cdm-primary/30 bg-cdm-primary-soft' : 'border-cdm-border bg-cdm-bg'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`min-w-0 truncate text-sm font-medium ${
            isMe ? 'text-cdm-primary' : 'text-cdm-fg'
          }`}
        >
          {isMe ? '나' : info.nickname}
          {isFirst && <span className="ml-1 text-xs text-amber-500">(선)</span>}
        </span>
        <span className="text-cdm-fg ml-2 shrink-0 text-sm font-bold tabular-nums">
          {info.score}/6
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              filled ? 'bg-emerald-400' : 'bg-cdm-border'
            }`}
          />
        ))}
      </div>
      <p className="text-cdm-fg-muted text-[11px] tabular-nums">타일 {info.tileCount}개</p>
    </div>
  );
}
