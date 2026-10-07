'use client';
import { usePresentationEffect } from '@/hooks/usePresentationEffect';
import type { WinningStreakGameData, WSPlayerInfo } from '@/shared/types/winning-streak';
import { useState } from 'react';
import { WinningStreakCard } from './WinningStreakCard';
import { REVEAL_STEPS } from './presentation';
import { Reveal } from './Reveal';

export function RevealArea({
  revealData,
  playerIds,
  players,
  myId,
}: {
  revealData: WinningStreakGameData['revealData'];
  playerIds: string[];
  players: Record<string, WSPlayerInfo>;
  myId: string | null;
}) {
  const [step, setStep] = useState(0);

  usePresentationEffect(() => {
    if (!revealData) return;
    setStep(0);
    const timers = REVEAL_STEPS.map((delay, i) => setTimeout(() => setStep(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, [revealData]);

  if (!revealData) return null;

  const orderedIds =
    myId && playerIds.includes(myId) ? [myId, ...playerIds.filter((id) => id !== myId)] : playerIds;

  return (
    <div className="my-auto flex w-full shrink-0 flex-col items-center gap-4">
      {/* Step 1~2: 카드 한 장씩 공개 */}
      <div className="flex items-center justify-center gap-6 sm:gap-12">
        {orderedIds.map((pid, idx) => {
          const pr = revealData.players[pid];
          if (!pr) return null;
          return (
            <div
              key={pid}
              className={`flex flex-col items-center gap-2 transition-all duration-500 ${step >= idx + 1 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
            >
              <span className="max-w-[90px] truncate text-sm font-medium text-gray-500 lg:max-w-[120px] lg:text-base">
                {players[pid]?.nickname}
              </span>
              <WinningStreakCard card={pr.card} />
            </div>
          );
        })}
      </div>

      {/* Step 3: 승패 + 설명 */}
      <Reveal visible={step >= 3}>
        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-base font-semibold text-gray-700 lg:text-lg">
            {revealData.matchDescription}
          </p>
          <div className="flex items-center justify-center gap-6 sm:gap-12">
            {orderedIds.map((pid) => {
              const pr = revealData.players[pid];
              if (!pr) return null;
              const isWin = pr.result === 'win' || pr.result === 'draw_win';
              const isLose = pr.result === 'lose' || pr.result === 'draw_lose';
              return (
                <span
                  key={pid}
                  className={`text-lg font-bold lg:text-xl ${isWin ? 'text-emerald-600' : isLose ? 'text-red-500' : 'text-gray-500'}`}
                >
                  {pr.result === 'win'
                    ? '승리'
                    : pr.result === 'lose'
                      ? '패배'
                      : pr.result === 'draw_win'
                        ? '양측 승리'
                        : '양측 패배'}
                </span>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Step 4: 연승 변화 */}
      <Reveal visible={step >= 4}>
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {orderedIds.map((pid) => {
            const pr = revealData.players[pid];
            if (!pr) return null;
            return (
              <div key={pid} className="flex flex-col items-center gap-0.5 text-sm">
                {pr.streakAfter > 0 ? (
                  <span className="font-bold text-orange-500">{pr.streakAfter}연승</span>
                ) : (
                  <span className="text-xs text-gray-400">연승 리셋</span>
                )}
                {pr.maxStreakUpdated && (
                  <span className="text-xs font-bold text-yellow-500 lg:text-sm">
                    최대 연승 갱신!
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
