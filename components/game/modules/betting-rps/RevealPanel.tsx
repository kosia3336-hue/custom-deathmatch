'use client';

import { useState, useEffect } from 'react';
import type { BRPSRevealData, BRPSPlayerInfo, BRPSWinType } from '@/shared/types/betting-rps';
import { RESULT_LABELS, RESULT_COLORS, OUTCOME_LABELS, OUTCOME_COLORS, WIN_TYPE_LABELS } from './constants';

interface Props {
  revealData: BRPSRevealData;
  players: Record<string, BRPSPlayerInfo>;
  round: number;
  winner: string | null;
  winType: BRPSWinType | null;
}

const STEPS = [
  350,   // step 1: 승부 플레이어 선택 공개
  1150,  // step 2: 베팅 플레이어 예측 공개
  2000,  // step 3: 베팅 결과 + 칩 변화 공개
];

export default function RevealPanel({ revealData, players, round, winner, winType }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = STEPS.map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [revealData]);

  const entries = Object.entries(revealData.players);
  const matchEntry = entries.find(([, p]) => p.role === 'match');
  const betEntry = entries.find(([, p]) => p.role === 'bet');

  return (
    <div className="space-y-3">
      {/* Round result card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="text-center text-sm font-bold text-gray-700">
          {round}라운드 결과
        </div>

        {/* Step 1: Match player result */}
        <div
          className={`transition-all duration-500 ${
            step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {matchEntry && (() => {
            const [pid, pd] = matchEntry;
            const nick = players[pid]?.nickname ?? '???';
            const result = pd.matchResult;
            const chipChange = pd.chipChange;
            return (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <div className="mb-1 text-xs font-medium text-blue-400">승부 플레이어</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-600 font-semibold">{nick}</span>
                  <div className="flex items-center gap-2">
                    {chipChange > 0 && (
                      <span className="text-xs font-semibold text-emerald-600">+{chipChange}칩</span>
                    )}
                    {result ? (
                      <span className={`text-xl font-bold ${RESULT_COLORS[result]}`}>
                        {RESULT_LABELS[result]}
                      </span>
                    ) : (
                      <span className="text-lg text-gray-300">—</span>
                    )}
                  </div>
                </div>
                {chipChange > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    {pd.chipsBefore}칩 → {pd.chipsAfter}칩
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Step 2: Bet player prediction */}
        <div
          className={`transition-all duration-500 ${
            step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {betEntry && (() => {
            const [pid, pd] = betEntry;
            const nick = players[pid]?.nickname ?? '???';
            const prediction = pd.prediction;
            const betChips = pd.betChips ?? 0;
            return (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                <div className="mb-1 text-xs font-medium text-emerald-400">베팅 플레이어</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 font-semibold">{nick}</span>
                  <div className="text-right">
                    {prediction ? (
                      <span className={`text-xl font-bold ${RESULT_COLORS[prediction]}`}>
                        {RESULT_LABELS[prediction]}
                      </span>
                    ) : (
                      <span className="text-lg text-gray-300">—</span>
                    )}
                    {betChips > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">{betChips}칩 베팅</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Step 3: Outcome + chip change */}
        <div
          className={`transition-all duration-500 ${
            step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {betEntry && (() => {
            const [, pd] = betEntry;
            const outcome = pd.betOutcome;
            const chipChange = pd.chipChange;
            return (
              <div className={`rounded-lg px-4 py-3 text-center ${
                outcome === 'success'
                  ? 'bg-emerald-500'
                  : outcome === 'fail'
                  ? 'bg-red-500'
                  : 'bg-amber-400'
              }`}>
                <div className="text-lg font-bold text-white">
                  {outcome ? OUTCOME_LABELS[outcome] : '—'}
                </div>
                {chipChange !== 0 && (
                  <div className="text-sm font-semibold text-white/90 mt-0.5">
                    {chipChange > 0 ? '+' : ''}{chipChange}칩
                  </div>
                )}
                <div className="text-xs text-white/70 mt-1">
                  {pd.chipsBefore}칩 → {pd.chipsAfter}칩
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Game winner — 결과 공개 후 표시 */}
      <div
        className={`transition-all duration-500 ${
          step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        {winner && winType && (
          <div className="rounded-lg bg-indigo-600 p-3 text-center text-sm font-bold text-white">
            {players[winner]?.nickname ?? '???'} 승리!
            <span className="ml-1 text-xs font-normal opacity-80">
              ({WIN_TYPE_LABELS[winType] ?? winType})
            </span>
          </div>
        )}

        {!winner && winType === 'draw' && (
          <div className="rounded-lg bg-amber-500 p-3 text-center text-sm font-bold text-white">
            무승부!
          </div>
        )}

        {step >= 3 && !winner && !winType && (
          <div className="text-center text-xs text-gray-400 animate-pulse">
            다음 라운드 준비 중...
          </div>
        )}
      </div>
    </div>
  );
}
