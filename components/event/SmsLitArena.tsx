'use client';

import { useEffect, useState } from 'react';
import type { SmsGameData, SmsMarkId } from '@/shared/types/sun-moon-star-event';
import { SMSE_MARK_IDS } from '@/shared/types/sun-moon-star-event';
import { MARK_STYLES } from '@/components/game/modules/sun-moon-star-2/constants';

interface Props {
  gameData: SmsGameData;
}

export default function SmsLitArena({ gameData: gd }: Props) {
  const isResolve = gd.phase === 'resolve';
  const isResolveFirst = gd.phase === 'resolveFirst';
  const showSecondResult = isResolve;
  const showFirstCounts = isResolveFirst;

  const activeLit = showSecondResult ? gd.litMark : null;
  const voidRound = showSecondResult && gd.voidRound;
  const counts = showSecondResult ? gd.secondCounts : showFirstCounts ? gd.firstCounts : null;

  const dimUnlit = showSecondResult && (activeLit != null || voidRound);
  const [pulseLit, setPulseLit] = useState(false);
  const [pulseCounts, setPulseCounts] = useState(false);

  useEffect(() => {
    if (showFirstCounts && counts) {
      setPulseCounts(true);
      const t = setTimeout(() => setPulseCounts(false), 800);
      return () => clearTimeout(t);
    }
    setPulseCounts(false);
  }, [showFirstCounts, counts, gd.roundNumber]);

  useEffect(() => {
    if (!showSecondResult || (!activeLit && !voidRound)) {
      setPulseLit(false);
      return;
    }
    setPulseLit(true);
    const t = setTimeout(() => setPulseLit(false), 1200);
    return () => clearTimeout(t);
  }, [showSecondResult, activeLit, voidRound, gd.roundNumber]);

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-3 gap-2.5 sm:gap-4">
      {SMSE_MARK_IDS.map((mark) => (
        <LitCell
          key={mark}
          mark={mark}
          lit={activeLit === mark}
          showFirstTally={showFirstCounts}
          dim={dimUnlit && activeLit !== mark}
          voidRound={voidRound}
          count={counts?.[mark]}
          showCount={(showSecondResult || showFirstCounts) && counts != null}
          pulse={pulseLit && activeLit === mark}
          pulseCount={pulseCounts && showFirstCounts}
        />
      ))}
    </div>
  );
}

function LitCell({
  mark,
  lit,
  showFirstTally,
  dim,
  voidRound,
  count,
  showCount,
  pulse,
  pulseCount,
}: {
  mark: SmsMarkId;
  lit: boolean;
  showFirstTally: boolean;
  dim: boolean;
  voidRound: boolean;
  count?: number;
  showCount: boolean;
  pulse: boolean;
  pulseCount: boolean;
}) {
  const style = MARK_STYLES[mark];

  const baseCls = lit
    ? `${style.bgLit} ${style.borderLit} ring-2 ${style.ringLit} ${style.glowLit} scale-[1.05]`
    : showFirstTally
      ? `${style.bgSoft} ${style.borderSoft} ring-1 ring-indigo-200/70`
      : `${style.bgSoft} ${style.borderSoft}`;

  const dimCls = dim && !voidRound ? 'opacity-40 grayscale' : voidRound && !lit ? 'opacity-50' : '';

  return (
    <div
      className={`relative flex flex-col items-center rounded-cdm-lg border-2 p-3.5 transition-all duration-500 sm:p-4 ${baseCls} ${dimCls} ${
        pulse ? 'animate-[smsEvtLitPulse_0.6s_ease-in-out_2]' : ''
      } ${pulseCount ? 'animate-[smsEvtLitPulse_0.6s_ease-in-out_1]' : ''}`}
    >
      {lit && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
          불빛
        </span>
      )}
      {showFirstTally && showCount && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
          1차
        </span>
      )}
      <span className={`text-3xl sm:text-4xl ${lit ? style.bigGlow : ''} ${lit ? 'animate-pulse' : ''}`}>
        {style.icon}
      </span>
      <span className={`mt-1 text-sm font-medium ${lit ? style.textLit : style.textSoft}`}>
        {style.label}
      </span>
      {showCount && count !== undefined && (
        <span
          className={`mt-1 text-xs tabular-nums ${
            showFirstTally ? 'font-semibold text-indigo-700' : 'text-cdm-muted'
          }`}
        >
          {count}표
        </span>
      )}
    </div>
  );
}
