'use client';

import { useState, useEffect } from 'react';
import type { IDRevealData, IDPlayerInfo, IDWinType } from '@/shared/types/invest-donate';
import { WIN_TYPE_LABELS } from './constants';

interface Props {
  revealData: IDRevealData;
  players: Record<string, IDPlayerInfo>;
  round: number;
  winner: string | null;
  winType: IDWinType | null;
  rematchReason: string | null;
}

// step 1: 투자 합계 | step 2: 기부 합계 | step 3: 대주주/수전노 | step 4: 점수 변화
const STEPS = [350, 850, 1450, 2100];

function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      {children}
    </div>
  );
}

export default function RevealPanel({ revealData, players, round, winner, winType, rematchReason }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const timers = STEPS.map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [revealData]);

  const pIds = Object.keys(revealData.players);

  const totalInvest = pIds.reduce((sum, pid) => sum + (revealData.players[pid]?.investTotal ?? 0), 0);
  const totalDonate = pIds.reduce((sum, pid) => sum + (revealData.players[pid]?.donateTotal ?? 0), 0);

  const majorPid = pIds.find((pid) => revealData.players[pid]?.investBadge === 'majorShareholder');
  const majorNick = majorPid ? (players[majorPid]?.nickname ?? '???') : null;

  const miserPids = pIds.filter((pid) => revealData.players[pid]?.donateBadge === 'miser');
  const miserNick = miserPids.length === 1 ? (players[miserPids[0]]?.nickname ?? '???') : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="text-center text-sm font-bold text-gray-700">
          {round}라운드 결과
        </div>

        {/* Step 1: 투자 합계 */}
        <Reveal visible={step >= 1}>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-14 shrink-0 text-xs text-gray-400">투자</span>
            <span className="font-semibold tabular-nums text-blue-600">{totalInvest}원</span>
          </div>
        </Reveal>

        {/* Step 2: 기부 합계 */}
        <Reveal visible={step >= 2}>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-14 shrink-0 text-xs text-gray-400">기부</span>
            <span className="font-semibold tabular-nums text-emerald-600">{totalDonate}원</span>
          </div>
        </Reveal>

        {/* Step 3: 대주주 / 수전노 */}
        <Reveal visible={step >= 3}>
          <div className="space-y-1.5 border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-amber-500 bg-transparent" />
              <span className="w-14 shrink-0 text-xs text-gray-400">대주주</span>
              {revealData.investTied ? (
                <span className="text-xs text-gray-400">없음 (공동)</span>
              ) : (
                <span className="font-semibold text-amber-700">{majorNick ?? '???'}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
              <span className="w-14 shrink-0 text-xs text-gray-400">수전노</span>
              {revealData.donateTied ? (
                <span className="font-semibold text-red-600">
                  {miserPids.map((pid) => players[pid]?.nickname).filter(Boolean).join(', ')}{' '}
                  <span className="text-xs font-normal text-red-400">(공동)</span>
                </span>
              ) : miserNick ? (
                <span className="font-semibold text-red-600">{miserNick}</span>
              ) : (
                <span className="text-xs text-gray-400">없음</span>
              )}
            </div>
          </div>
        </Reveal>

        {/* Step 4: 플레이어별 점수 변화 */}
        <Reveal visible={step >= 4}>
          <div className="border-t border-gray-100 pt-2 space-y-1.5">
            {pIds.map((pid) => {
              const pr = revealData.players[pid];
              const p = players[pid];
              if (!pr || !p) return null;
              const change = pr.scoreChange;
              return (
                <div key={pid} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{p.nickname}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {change > 0 ? `+${change}점` : change < 0 ? `${change}점` : '±0점'}
                    </span>
                    <span className="font-bold tabular-nums text-gray-700">{p.score}점</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>

      {/* 게임 종료 / 재경기 / 다음 라운드 */}
      <Reveal visible={step >= 4}>
        {winner && winType && (
          <div className="rounded-lg bg-indigo-600 p-3 text-center text-sm font-bold text-white">
            {players[winner]?.nickname ?? '???'} 승리!
            <span className="ml-1 text-xs font-normal opacity-80">
              ({WIN_TYPE_LABELS[winType] ?? winType})
            </span>
          </div>
        )}
        {rematchReason && !winner && (
          <div className="rounded-lg bg-amber-500 p-3 text-center text-sm font-bold text-white">
            재경기! — {rematchReason}
          </div>
        )}
        {!winner && !rematchReason && (
          <div className="text-center text-xs text-gray-400 animate-pulse">
            다음 라운드 준비 중...
          </div>
        )}
      </Reveal>
    </div>
  );
}
