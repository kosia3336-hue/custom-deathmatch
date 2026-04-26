'use client';

import { Fragment } from 'react';
import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';
import { buildTurnLabel, stepIndexFromPhase, STEPS } from './phaseSteps';

/* ════════════════════════════════════════════════════════════
 * PhaseStepperDesktop — 데스크탑 가로 풀폭 4단계 인디케이터
 *   · 각 노드: 24px 원 + 12px 라벨
 *   · 우측 동적 active 라벨 (예: "내가 선 베팅 중")
 *   · 헤더 바로 아래에 가로로 배치
 * ════════════════════════════════════════════════════════════ */

interface Props {
  phase: SMS2GameData['phase'];
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst?: boolean;
}

export default function PhaseStepperDesktop({
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
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5"
    >
      <div className="flex flex-1 items-center">
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
              <StepNode label={step.label} state={state} />
              {i < STEPS.length - 1 && (
                <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-gray-200">
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
          className={`shrink-0 text-xs font-bold ${
            isMyTurn && !isSpectator ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          {turnLabel}
        </p>
      )}
    </div>
  );
}

function StepNode({
  label,
  state,
}: {
  label: string;
  state: 'done' | 'active' | 'pending';
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
          state === 'done'
            ? 'bg-indigo-500 text-white'
            : state === 'active'
              ? 'bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-1 ring-offset-white animate-[sms2StepPulse_1.6s_ease-in-out_infinite]'
              : 'bg-gray-200 text-gray-400'
        }`}
      >
        {state === 'done' ? '✓' : state === 'active' ? '●' : '○'}
      </div>
      <span
        className={`text-[11px] ${
          state === 'active'
            ? 'font-bold text-amber-700'
            : state === 'done'
              ? 'font-medium text-indigo-500'
              : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
