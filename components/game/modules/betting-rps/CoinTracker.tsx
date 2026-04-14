'use client';

interface CoinTrackerProps {
  opponentNickname?: string;
  value: number;
  maxValue: number;
  onAdjust: (delta: number) => void;
}

export default function CoinTracker({ opponentNickname, value, maxValue, onAdjust }: CoinTrackerProps) {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold text-gray-400 tracking-wide">
        {opponentNickname ? `${opponentNickname} 베팅 추리` : '상대 베팅 추리'}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-5 w-5 shrink-0 rounded-full border border-amber-400 bg-amber-100" />
          <span className="text-xs text-gray-500">베팅 칩</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAdjust(-1)}
            disabled={value <= 0}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="베팅 칩 감소"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums text-gray-700">
            {value}
          </span>
          <button
            onClick={() => onAdjust(1)}
            disabled={value >= maxValue}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="베팅 칩 증가"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
