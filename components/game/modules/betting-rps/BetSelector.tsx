'use client';

import { useState } from 'react';
import type { BRPSResult } from '@/shared/types/betting-rps';
import { BRPS_BET_MULTIPLIER } from '@/shared/types/betting-rps';
import { getSocket } from '@/lib/socket';
import { RESULT_LABELS } from './constants';

const RESULTS: BRPSResult[] = ['win', 'draw', 'lose'];

const BUTTON_STYLES: Record<BRPSResult, string> = {
  win: 'border-blue-300 text-blue-700 hover:border-blue-500 hover:bg-blue-50',
  draw: 'border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-50',
  lose: 'border-red-300 text-red-700 hover:border-red-500 hover:bg-red-50',
};

const SELECTED_STYLES: Record<BRPSResult, string> = {
  win: 'border-blue-500 bg-blue-500 text-white',
  draw: 'border-amber-500 bg-amber-500 text-white',
  lose: 'border-red-500 bg-red-500 text-white',
};

interface Props {
  myChips: number;
  disabled?: boolean;
}

export default function BetSelector({ myChips, disabled }: Props) {
  const [prediction, setPrediction] = useState<BRPSResult | null>(null);
  const [betChips, setBetChips] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!prediction || submitted) return;
    setSubmitted(true);
    getSocket().emit('game:action', { type: 'submitBet', prediction, chips: betChips });
  }

  function changeChips(delta: number) {
    setBetChips((prev) => Math.max(0, Math.min(myChips, prev + delta)));
  }

  // 승/패 예측: 성공 시 net +betChips (multiplier=2), 무 예측: 성공 시 net +betChips*(BRPS_BET_MULTIPLIER-1)
  const gainIfSuccess = prediction === 'draw'
    ? betChips * (BRPS_BET_MULTIPLIER - 1)
    : betChips;
  const loseIfFail = betChips;
  const hasRefund = prediction !== null && prediction !== 'draw';

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
      <div className="text-center text-sm font-medium text-emerald-800">
        예측 + 베팅
      </div>

      {/* Prediction */}
      <div>
        <div className="mb-1.5 text-xs text-emerald-700">예측 선택</div>
        <div className="flex gap-2">
          {RESULTS.map((r) => (
            <button
              key={r}
              onClick={() => !submitted && setPrediction(r)}
              disabled={submitted || disabled}
              className={`flex-1 rounded-lg border-2 bg-white py-2.5 text-base font-bold transition disabled:cursor-not-allowed ${
                prediction === r ? SELECTED_STYLES[r] : BUTTON_STYLES[r]
              }`}
            >
              {RESULT_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Chip bet */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-emerald-700">
          <span>베팅 칩</span>
          <span className="text-gray-400">보유: {myChips}칩</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeChips(-1)}
            disabled={betChips === 0 || submitted || disabled}
            className="h-8 w-8 rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="flex-1 text-center text-lg font-bold tabular-nums text-gray-800">
            {betChips}
          </span>
          <button
            onClick={() => changeChips(1)}
            disabled={betChips >= myChips || submitted || disabled}
            className="h-8 w-8 rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ＋
          </button>
        </div>
        {betChips > 0 && (
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-emerald-600">성공 시 +{gainIfSuccess}칩</span>
              <span className="text-red-500">실패 시 −{loseIfFail}칩</span>
            </div>
            {hasRefund && (
              <div className="text-center text-[11px] text-amber-500">무 결과 시 베팅 환불</div>
            )}
          </div>
        )}
        {betChips === 0 && (
          <div className="mt-1 text-center text-[11px] text-gray-400">
            0칩 베팅 — 결과에 상관없이 칩 변동 없음
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={!prediction || submitted || disabled || (myChips > 0 && betChips === 0)}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitted ? '제출 완료' : '제출'}
      </button>
    </div>
  );
}
