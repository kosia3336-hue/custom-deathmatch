'use client';

import { Fragment } from 'react';
import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';
import { buildTurnLabel, stepIndexFromPhase, STEPS } from './phaseSteps';

/* ════════════════════════════════════════════════════════════
 * PhaseStepperMobile — 모바일 컴팩트 4점 인디케이터
 *   · 노드별 텍스트 라벨 없음 (폭 절약)
 *   · active 동적 라벨 1줄만 (12px)
 *   · 노드 직경 16px, connector 4px
 * ════════════════════════════════════════════════════════════ */

interface Props {
  phase: SMS2GameData['phase'];
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst?: boolean;
}

export default function PhaseStepperMobile({
  phase,
  isMyTurn,
  isSpectator,
  firstNick,
  secondNick,
  myIsFirst,
}: Props) {
  const activeIndex = stepIndexFromPhase(phase);
  const turnLabel = buildTurnLabel({
    phase,
    isMyTurn,
    isSpectator,
    firstNick,
    secondNick,
    myIsFirst,
  });

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={STEPS.length}
      aria-valuenow={Math.max(0, activeIndex + 1)}
      aria-valuetext={turnLabel ?? STEPS[Math.max(0, activeIndex)]?.label}
      className="flex w-full min-w-0 flex-col items-center gap-1 overflow-hidden px-2 py-1"
    >
      <div className="flex w-full max-w-xs items-center justify-between">
        {STEPS.map((step, i) => {
          const state =
            activeIndex < 0
              ? 'pending'
              : i < activeIndex
                ? 'done'
                : i === activeIndex
                  ? 'active'
                  : 'pending';
          return (
            <Fragment key={step.key}>
              <DotNode state={state} />
              {i < STEPS.length - 1 && (
                <div className="mx-0.5 h-0.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i < activeIndex
                        ? 'w-full bg-indigo-400'
                        : i === activeIndex
                          ? 'w-1/2 bg-indigo-300'
                          : 'w-0 bg-transparent'
                    }`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      {turnLabel && (
        <p
          aria-live="polite"
          className={`text-center text-[11px] font-semibold ${
            isMyTurn && !isSpectator ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          {turnLabel}
        </p>
      )}
    </div>
  );
}

function DotNode({ state }: { state: 'done' | 'active' | 'pending' }) {
  return (
    <div
      className={`h-4 w-4 shrink-0 rounded-full transition-all duration-300 ${
        state === 'done'
          ? 'bg-indigo-500'
          : state === 'active'
            ? 'bg-amber-500 ring-2 ring-amber-300 ring-offset-1 ring-offset-white animate-[sms2StepPulse_1.6s_ease-in-out_infinite]'
            : 'bg-gray-200'
      }`}
    />
  );
}
