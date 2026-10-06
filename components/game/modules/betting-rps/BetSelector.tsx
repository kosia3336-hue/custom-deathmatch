'use client';
import { brpsBetMultiplier, type BRPSResult } from '@/shared/types/betting-rps';
import ResultChoices from './ResultChoices';
import { useBettingInput } from './useBettingInput';
export default function BetSelector({
  myChips,
  disabled,
  dreamshop = false,
  onSubmit,
}: {
  myChips: number;
  disabled?: boolean;
  dreamshop?: boolean;
  onSubmit: (prediction: BRPSResult, chips: number) => void;
}) {
  const input = useBettingInput(myChips);
  const gain = input.chips * (input.prediction ? brpsBetMultiplier(input.prediction) - 1 : 1);
  return (
    <div
      data-brps-input
      className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
    >
      <div className="text-center text-sm font-medium text-emerald-800">예측 + 베팅</div>
      <ResultChoices
        dreamshop={dreamshop}
        value={input.prediction}
        onChange={input.setPrediction}
        disabled={disabled}
      />
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-emerald-700">
          <span>베팅 칩</span>
          <span>보유 {myChips}칩</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-brps-chip-step
            aria-label="베팅 칩 줄이기"
            disabled={disabled || input.chips <= input.bounds.min}
            onClick={() => input.changeChips(-1)}
            className="h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-40"
          >
            −
          </button>
          <span className="flex-1 text-center text-lg font-bold text-gray-800">{input.chips}</span>
          <button
            data-brps-chip-step
            aria-label="베팅 칩 늘리기"
            disabled={disabled || input.chips >= input.bounds.max}
            onClick={() => input.changeChips(1)}
            className="h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-40"
          >
            +
          </button>
        </div>
        {input.chips > 0 ? (
          <div className="mt-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-emerald-700">성공 시 +{gain}칩</span>
              <span className="text-red-600">실패 시 −{input.chips}칩</span>
            </div>
            {input.prediction && input.prediction !== 'draw' && (
              <div className="text-center text-amber-700">무 결과 시 베팅 환불</div>
            )}
          </div>
        ) : (
          <div className="mt-1 text-center text-[11px] text-gray-500">
            보유 칩 없음 · 예측만 제출합니다.
          </div>
        )}
      </div>
      <button
        data-brps-submit
        disabled={disabled || !input.canSubmit}
        onClick={() => {
          if (input.prediction && input.canSubmit && !disabled)
            onSubmit(input.prediction, input.chips);
        }}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        제출
      </button>
    </div>
  );
}
