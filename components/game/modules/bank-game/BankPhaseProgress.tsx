import type { BankPhase } from '@/shared/types/bank-game';
import { bankProgressIndex } from '@/lib/bankGameUi';
import { STEPPER_PHASE_LABELS } from './constants';

/** 상태 표시 전용. 클릭해서 서버 단계를 넘기는 버튼이 아니다. */
export function BankPhaseProgress({
  phase,
  treasury = false,
}: {
  phase: BankPhase;
  treasury?: boolean;
}) {
  const active = bankProgressIndex(phase);
  return (
    <ol
      aria-label="라운드 진행 상황"
      className={`bank-phase-stepper mx-auto flex w-full max-w-2xl items-center rounded-xl border px-3 py-2 ${treasury ? 'border-[#b78b46]/40 bg-[#101c27] text-[#aeb6bb]' : 'border-slate-200 bg-white text-slate-400'}`}
    >
      {STEPPER_PHASE_LABELS.map((step, index) => {
        const state = index < active ? 'done' : index === active ? 'active' : 'pending';
        const color =
          state === 'active'
            ? treasury
              ? 'text-[#f1d08a]'
              : 'text-orange-600'
            : state === 'done'
              ? treasury
                ? 'text-[#c79a52]'
                : 'text-indigo-600'
              : treasury
                ? 'text-[#aeb6bb]'
                : 'text-slate-400';
        return (
          <li
            key={step.key}
            data-bank-step={step.key}
            data-state={state}
            aria-current={state === 'active' ? 'step' : undefined}
            className={`bank-step-node flex min-w-0 items-center ${index < 3 ? 'flex-1' : ''} ${color}`}
          >
            <span className="flex shrink-0 flex-col items-center gap-1 sm:flex-row sm:gap-1.5">
              <span
                aria-hidden
                className={`bank-step-dot flex h-5 w-5 items-center justify-center rounded-full ${state === 'active' ? (treasury ? 'bg-[#d6a447]' : 'bg-orange-400') : state === 'done' ? (treasury ? 'bg-[#b78b46]' : 'bg-indigo-500') : treasury ? 'bg-[#283641]' : 'bg-slate-200'}`}
              >
                {state === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="bank-step-label text-[11px] leading-tight font-medium whitespace-nowrap">
                {step.label}
              </span>
            </span>
            {index < 3 && (
              <span
                aria-hidden
                className={`bank-step-connector mx-2 h-0.5 min-w-2 flex-1 ${index < active ? (treasury ? 'bg-[#b78b46]' : 'bg-indigo-400') : treasury ? 'bg-[#283641]' : 'bg-slate-200'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
