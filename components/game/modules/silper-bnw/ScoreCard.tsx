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
        isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`min-w-0 truncate text-sm font-medium ${
            isMe ? 'text-indigo-700' : 'text-gray-700'
          }`}
        >
          {isMe ? '나' : info.nickname}
          {isFirst && <span className="ml-1 text-xs text-amber-500">(선)</span>}
        </span>
        <span className="ml-2 shrink-0 text-sm font-bold text-gray-800 tabular-nums">
          {info.score}/6
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              filled ? 'bg-emerald-400' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-gray-500 tabular-nums">타일 {info.tileCount}개</p>
    </div>
  );
}
