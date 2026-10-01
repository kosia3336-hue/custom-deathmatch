'use client';

import { useEffect, useState } from 'react';
import type {
  MBNWResultData, MBNWWinType,
} from '@/shared/types/multiple-bnw';
import { WIN_TYPE_LABELS } from './constants';

interface ResultPanelProps {
  resultData: MBNWResultData;
  players: Record<string, { id: string; nickname: string; score: number }>;
  round: number;
  winner: string | null;
  winType: MBNWWinType;
  myId: string;
}

// Step 0: color badges pulse
// Step 1: suspect result badges appear
// Step 2: normal result text appears
// Step 3: score changes appear
const STEP_DELAYS = [0, 400, 1000, 1400];

export default function ResultPanel({ resultData, players, round, winner, winType, myId }: ResultPanelProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = STEP_DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [resultData]);

  const entries = Object.entries(resultData.players);
  const hasSuspectWinner = entries.some(([, pr]) => pr.suspectSuccess === true);

  return (
    <div className="mbnw-panel mbnw-result-panel flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="mbnw-panel-title text-center text-sm font-semibold text-indigo-800">
        라운드 {round} 결과
      </p>

      <div className="grid grid-cols-2 gap-3">
        {entries.map(([pid, pr]) => {
          const p = players[pid];
          const isMe = pid === myId;
          const hasScoreGain = pr.totalScoreChange > 0;

          return (
            <div
              key={pid}
              className={`mbnw-result-player ${hasScoreGain ? 'mbnw-result-player--gain' : ''} flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all duration-500 ${
                hasScoreGain
                  ? 'border-indigo-300 bg-white shadow-sm'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Player name */}
              <span className={`text-sm font-medium ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                {isMe ? '나' : (p?.nickname ?? pid)}
              </span>

              {/* Color badge — Step 0 (always visible, pulses on mount) */}
              <div className={`mbnw-result-color mbnw-result-color--${pr.color} flex h-[52px] w-[52px] items-center justify-center rounded-lg border-2 text-sm font-bold transition-all duration-300 ${
                step === 0 ? 'scale-110' : 'scale-100'
              } ${
                pr.color === 'black'
                  ? 'border-slate-600 bg-slate-800 text-slate-100'
                  : 'border-gray-300 bg-white text-slate-700'
              }`}>
                {pr.color === 'black' ? '흑색' : '백색'}
              </div>

              {/* Suspect result — Step 1 */}
              <div className={`transition-all duration-300 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                {pr.suspected ? (
                  <span className={`text-xs font-bold ${
                    pr.suspectSuccess ? 'text-violet-600' : 'text-red-500'
                  }`}>
                    {pr.suspectSuccess ? '배수의심 성공' : '배수의심 실패'}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </div>

              {/* Normal result — Step 2 */}
              <div className={`transition-all duration-300 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                {!hasSuspectWinner && pr.normalWin !== null && (
                  <span className={`text-xs font-medium ${
                    pr.normalWin ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {pr.normalWin ? '숫자 높음' : '숫자 낮음'}
                  </span>
                )}
                {!hasSuspectWinner && pr.normalWin === null && (
                  <span className="text-xs text-gray-400">동점</span>
                )}
              </div>

              {/* Score change — Step 3 */}
              <div className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                {pr.bonusPoint > 0 && (
                  <span className="text-[11px] font-semibold text-amber-600">+{pr.bonusPoint} 보너스</span>
                )}
                {pr.normalPoint > 0 && (
                  <span className={`text-[11px] font-semibold ${pr.suspectSuccess ? 'text-violet-600' : 'text-green-600'}`}>
                    +{pr.normalPoint} {pr.suspectSuccess ? '(의심성공)' : ''}
                  </span>
                )}
                {pr.totalScoreChange === 0 && (
                  <span className="text-[11px] text-gray-400">+0</span>
                )}
                <span className="text-sm font-bold text-gray-800">{pr.scoreAfter}점</span>
              </div>
            </div>
          );
        })}
      </div>

      {winType && (
        <div className={`mt-1 text-center transition-all duration-500 ${step >= 3 ? 'opacity-100' : 'opacity-0'}`}>
          {winner ? (
            <>
              <p className="text-lg font-bold text-indigo-700">
                {players[winner]?.nickname ?? winner} 승리!
              </p>
              <p className="text-xs text-gray-500">{WIN_TYPE_LABELS[winType] ?? winType}</p>
            </>
          ) : (
            <p className="text-lg font-bold text-amber-600">무승부</p>
          )}
        </div>
      )}
    </div>
  );
}
