'use client';

import { useState, useEffect } from 'react';
import type { NF4RevealData, NF4PlayerInfo, NF4WinType } from '@/shared/types/number4';
import { NUMBER_INFO, WIN_TYPE_LABELS } from './constants';

interface RevealPanelProps {
  revealData: NF4RevealData;
  players: Record<string, NF4PlayerInfo>;
  round: number;
  winner: string | null;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
}

// step 1: 넘버 공개 | step 2: 조건 판정 | step 3: 점수 변화 + 누적
const STEPS = [350, 1000, 1700];

function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      {children}
    </div>
  );
}

export default function RevealPanel({ revealData, players, round, winner, winType, tiebreakerReason }: RevealPanelProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = STEPS.map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [revealData]);

  const playerEntries = Object.entries(players);
  const isFinished = !!winner;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-center text-sm font-semibold text-gray-600">
        라운드 {round} — 결과
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {playerEntries.map(([pid, player]) => {
          const reveal = revealData.players[pid];
          if (!reveal) return null;
          const numInfo = NUMBER_INFO.find((n) => n.number === reveal.number);

          return (
            <div key={pid} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-700 truncate">{player.nickname}</div>

              {/* Step 1: 넘버 */}
              <Reveal visible={step >= 1}>
                <span className="text-2xl font-bold" style={{ color: numInfo?.color }}>
                  넘버 {reveal.number}
                </span>
              </Reveal>

              {/* Step 2: 조건 판정 */}
              <Reveal visible={step >= 2}>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">{reveal.conditionDetail}</div>
                  <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ${
                    reveal.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <span>{reveal.success ? '✅' : '❌'}</span>
                    <span>{reveal.success ? '성공' : '실패'}</span>
                  </div>
                </div>
              </Reveal>

              {/* Step 3: 점수 변화 + 누적 */}
              <Reveal visible={step >= 3}>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className={`text-sm font-semibold ${
                    reveal.scoreChange > 0 ? 'text-emerald-600' : reveal.scoreChange < 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {reveal.scoreChange > 0 ? `+${reveal.scoreChange}점` : reveal.scoreChange < 0 ? `${reveal.scoreChange}점` : '±0점'}
                  </span>
                  <span className="text-base font-bold text-gray-800">{player.score}점</span>
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>

      {isFinished && winType && (
        <Reveal visible={step >= 3}>
          <div className="rounded-lg bg-indigo-50 p-3 text-center">
            <div className="text-sm font-semibold text-indigo-700">
              {WIN_TYPE_LABELS[winType]}
            </div>
            {tiebreakerReason && (
              <div className="mt-1 text-xs text-indigo-500">{tiebreakerReason}</div>
            )}
          </div>
        </Reveal>
      )}

      {!isFinished && step >= 3 && (
        <div className="text-center text-xs text-gray-400 animate-pulse">
          다음 라운드로 이동 중...
        </div>
      )}
    </div>
  );
}
