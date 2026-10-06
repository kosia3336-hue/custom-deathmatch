'use client';

import { useState, useEffect } from 'react';
import type { NF4RevealData, NF4PlayerInfo, NF4WinType } from '@/shared/types/number4';
import type { SkinTheme } from '@/lib/skins/registry';
import { NUMBER_INFO, WIN_TYPE_LABELS } from './constants';
import { NF4_REVEAL_DELAY_MS } from '@/shared/types/number4';
import CountdownRing from '@/components/game/CountdownRing';
import { DualityRevealBadge, DualityScoreChange } from './skins/DualityRevealFx';

interface RevealPanelProps {
  revealData: NF4RevealData;
  players: Record<string, NF4PlayerInfo>;
  round: number;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
  skin?: SkinTheme | null;
  automatic?: boolean;
  revealEndsAt?: number;
}

// step 1: 넘버 공개 | step 2: 조건 판정 | step 3: 점수 변화 + 누적
const STEPS = [350, 1000, 1700];

function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {children}
    </div>
  );
}

export default function RevealPanel({
  revealData,
  players,
  winType,
  tiebreakerReason,
  skin,
  automatic = true,
  revealEndsAt,
}: RevealPanelProps) {
  const [step, setStep] = useState(0);
  const isDuality = skin === 'duality';

  useEffect(() => {
    setStep(0);
    const timers = STEPS.map((delay, i) => setTimeout(() => setStep(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, [revealData]);

  const playerEntries = Object.entries(players);
  /* 무승부는 승자가 없다 — 끝났는지는 승자가 아니라 winType 으로 본다 */
  const isFinished = !!winType;

  if (isDuality) {
    return (
      <div data-number-four-reveal className="skin-duality-reveal-panel flex flex-col gap-2 p-3">
        <div data-reveal-heading className="text-center text-sm font-semibold text-slate-400">
          제출 결과
        </div>

        <div className="grid grid-cols-2 gap-2">
          {playerEntries.map(([pid, player]) => {
            const reveal = revealData.players[pid];
            if (!reveal) return null;
            const numInfo = NUMBER_INFO.find((n) => n.number === reveal.number);

            return (
              <div
                data-reveal-player
                key={pid}
                className="skin-duality-reveal-player-card flex flex-col gap-2 p-2"
              >
                <div className="truncate text-sm font-medium text-slate-300">{player.nickname}</div>

                <Reveal visible={step >= 1}>
                  <span
                    data-reveal-number
                    className="skin-duality-reveal-number text-2xl font-bold"
                    style={{ color: numInfo?.color }}
                  >
                    넘버 {reveal.number}
                  </span>
                </Reveal>

                <Reveal visible={step >= 2}>
                  <div className="space-y-1">
                    <div data-reveal-condition className="text-xs text-slate-500">
                      {reveal.conditionDetail}
                    </div>
                    <DualityRevealBadge success={reveal.success} />
                  </div>
                </Reveal>

                <Reveal visible={step >= 3}>
                  <div className="flex items-center justify-between border-t border-slate-700/50 pt-2">
                    <DualityScoreChange scoreChange={reveal.scoreChange} />
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>

        {isFinished && winType && (
          <Reveal visible={step >= 3}>
            <div className="skin-duality-reveal-finish p-3 text-center">
              <div className="text-sm font-semibold">{WIN_TYPE_LABELS[winType]}</div>
              {tiebreakerReason && (
                <div className="mt-1 text-xs opacity-70">{tiebreakerReason}</div>
              )}
            </div>
          </Reveal>
        )}

        {automatic && !isFinished && (
          <div className="flex justify-center">
            <CountdownRing
              deadline={revealEndsAt}
              durationMs={NF4_REVEAL_DELAY_MS}
              size={24}
              label="다음 라운드로 전환 중"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-number-four-reveal
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3"
    >
      <div data-reveal-heading className="text-center text-sm font-semibold text-gray-600">
        제출 결과
      </div>

      <div className="grid grid-cols-2 gap-2">
        {playerEntries.map(([pid, player]) => {
          const reveal = revealData.players[pid];
          if (!reveal) return null;
          const numInfo = NUMBER_INFO.find((n) => n.number === reveal.number);

          return (
            <div
              key={pid}
              data-reveal-player
              className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2"
            >
              <div className="truncate text-sm font-medium text-gray-700">{player.nickname}</div>

              <Reveal visible={step >= 1}>
                <span
                  data-reveal-number
                  className="text-2xl font-bold"
                  style={{ color: numInfo?.color }}
                >
                  넘버 {reveal.number}
                </span>
              </Reveal>

              <Reveal visible={step >= 2}>
                <div className="space-y-1">
                  <div data-reveal-condition className="text-xs text-gray-500">
                    {reveal.conditionDetail}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ${
                      reveal.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <span>{reveal.success ? '' : ''}</span>
                    <span>{reveal.success ? '성공' : '실패'}</span>
                  </div>
                </div>
              </Reveal>

              <Reveal visible={step >= 3}>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span
                    className={`text-sm font-semibold ${
                      reveal.scoreChange > 0
                        ? 'text-emerald-600'
                        : reveal.scoreChange < 0
                          ? 'text-red-500'
                          : 'text-gray-400'
                    }`}
                  >
                    {reveal.scoreChange > 0
                      ? `+${reveal.scoreChange}점`
                      : reveal.scoreChange < 0
                        ? `${reveal.scoreChange}점`
                        : '±0점'}
                  </span>
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>

      {isFinished && winType && (
        <Reveal visible={step >= 3}>
          <div className="rounded-lg bg-indigo-50 p-3 text-center">
            <div className="text-sm font-semibold text-indigo-700">{WIN_TYPE_LABELS[winType]}</div>
            {tiebreakerReason && (
              <div className="mt-1 text-xs text-indigo-500">{tiebreakerReason}</div>
            )}
          </div>
        </Reveal>
      )}

      {automatic && !isFinished && (
        <div className="flex justify-center">
          <CountdownRing
            deadline={revealEndsAt}
            durationMs={NF4_REVEAL_DELAY_MS}
            size={24}
            label="다음 라운드로 전환 중"
          />
        </div>
      )}
    </div>
  );
}
