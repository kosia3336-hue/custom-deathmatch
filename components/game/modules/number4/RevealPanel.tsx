'use client';

import { useState, useEffect } from 'react';
import type { NF4RevealData, NF4PlayerInfo, NF4WinType } from '@/shared/types/number4';
import type { SkinTheme } from '@/lib/skins/registry';
import { NUMBER_INFO, WIN_TYPE_LABELS } from './constants';
import { NF4_REVEAL_DELAY_MS } from '@/shared/types/number4';
import CountdownRing from '@/components/game/CountdownRing';
import { ResultBadge, ScoreDelta } from './Presentation';
import styles from './number-four.module.css';

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

export default function RevealPanel(props: RevealPanelProps) {
  return <AnimatedRevealPanel key={props.round} {...props} />;
}

function AnimatedRevealPanel({
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
    const timers = STEPS.map((delay, i) => setTimeout(() => setStep(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  const playerEntries = Object.entries(players);
  /* 무승부는 승자가 없다 — 끝났는지는 승자가 아니라 winType 으로 본다 */
  const isFinished = !!winType;

  return (
    <div
      data-number-four-reveal
      data-skin={isDuality ? 'duality' : 'default'}
      className={`${styles.revealPanel} ${isDuality ? 'skin-duality-reveal-panel' : ''} flex flex-col gap-2 p-3`}
    >
      <div
        data-reveal-heading
        className={`${styles.secondaryText} text-center text-sm font-semibold`}
      >
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
              className={`${styles.revealPlayer} ${isDuality ? 'skin-duality-reveal-player-card' : ''} flex flex-col gap-2 p-2`}
            >
              <div className={`${styles.primaryText} truncate text-sm font-medium`}>
                {player.nickname}
              </div>

              <Reveal visible={step >= 1}>
                <span
                  data-reveal-number
                  className={`${isDuality ? 'skin-duality-reveal-number' : ''} text-2xl font-bold`}
                  style={{ color: numInfo?.color }}
                >
                  넘버 {reveal.number}
                </span>
              </Reveal>

              <Reveal visible={step >= 2}>
                <div className="space-y-1">
                  <div data-reveal-condition className={`${styles.mutedText} text-xs`}>
                    {reveal.conditionDetail}
                  </div>
                  <ResultBadge success={reveal.success} duality={isDuality} />
                </div>
              </Reveal>

              <Reveal visible={step >= 3}>
                <div
                  className={`${styles.divider} flex items-center justify-between border-t pt-2`}
                >
                  <span className="text-sm font-semibold">
                    <ScoreDelta value={reveal.scoreChange} points duality={isDuality} />
                  </span>
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>

      {isFinished && winType && (
        <Reveal visible={step >= 3}>
          <div
            className={`${styles.revealFinish} ${isDuality ? 'skin-duality-reveal-finish' : ''} p-3 text-center`}
          >
            <div className="text-sm font-semibold">{WIN_TYPE_LABELS[winType]}</div>
            {tiebreakerReason && <div className="mt-1 text-xs opacity-70">{tiebreakerReason}</div>}
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
