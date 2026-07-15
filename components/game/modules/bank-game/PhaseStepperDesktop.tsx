'use client';

import { Fragment } from 'react';
import type { BankPhase } from '@/shared/types/bank-game';
import { STEPPER_PHASE_LABELS, buildBankTurnLabel } from './constants';

interface Props {
  phase: BankPhase;
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst?: boolean;
}

function stepIndexFromPhase(phase: BankPhase): number {
  switch (phase) {
    case 'firstSubmit': return 0;
    case 'firstReveal': return 1;
    case 'secondSubmit': return 2;
    case 'reveal':
    case 'roundEnd':
    case 'finished':
      return 3;
    default: return -1;
  }
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
  const turnLabel = buildBankTurnLabel({
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
      aria-valuemax={STEPPER_PHASE_LABELS.length}
      aria-valuenow={Math.max(0, activeIndex + 1)}
      aria-valuetext={turnLabel ?? STEPPER_PHASE_LABELS[Math.max(0, activeIndex)]?.label}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5"
    >
      <div className="flex flex-1 items-center">
        {STEPPER_PHASE_LABELS.map((step, i) => {
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
              {i < STEPPER_PHASE_LABELS.length - 1 && (
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
              ? 'bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-1 ring-offset-white animate-[bankStepPulse_1.6s_ease-in-out_infinite]'
              : 'bg-gray-200 text-gray-400'
        }`}
      >
        {state === 'done' ? '' : state === 'active' ? '●' : '○'}
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
