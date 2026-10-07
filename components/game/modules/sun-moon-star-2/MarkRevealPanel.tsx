'use client';

import type {
  SMS2ChipBet,
  SMS2PlayerPublic,
  SMS2ResolveStep,
  SMS2Side,
} from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, sumBet } from '@/shared/types/sun-moon-star-2';
import { useState } from 'react';
import { usePresentationEffect } from '@/hooks/usePresentationEffect';
import { MARK_STYLES, RESOLVE_FIRST_DELAY_MS, RESOLVE_STEP_INTERVAL_MS } from './constants';

/* ════════════════════════════════════════════════════════════
 * MarkRevealPanel — 정산 단계 연출 패널
 *   · resolveSteps: 서버에서 받은 정산 스텝 시퀀스
 *   · 타이밍에 맞춰 1→N 점진 표시
 * ════════════════════════════════════════════════════════════ */

interface Props {
  resolveSteps: SMS2ResolveStep[] | null;
  round: number;
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
  mySide: SMS2Side | null;
}

export default function MarkRevealPanel({ resolveSteps, round, players, mySide }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  usePresentationEffect(() => {
    if (!resolveSteps || resolveSteps.length === 0) {
      setStepIdx(0);
      return;
    }
    setStepIdx(0);
    setSelectedStep(null);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < resolveSteps.length; i++) {
      timers.push(
        setTimeout(() => setStepIdx(i + 1), RESOLVE_FIRST_DELAY_MS + i * RESOLVE_STEP_INTERVAL_MS),
      );
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [round]);

  /* roundEnd 페이즈: resolveSteps 없음 → 빈 상태 유지 */
  if (!resolveSteps || resolveSteps.length === 0) {
    return null;
  }

  const activeIndex = selectedStep ?? Math.max(0, stepIdx - 1);
  const visible = stepIdx > 0 ? [resolveSteps[activeIndex]] : [];
  const total = resolveSteps.length;

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:space-y-3 lg:p-4">
      {/* 진행 인디케이터 */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-violet-600 uppercase lg:text-xs">
          정산 중
        </span>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 lg:h-2 lg:w-2 ${
                i < stepIdx ? 'scale-110 bg-violet-500' : 'bg-gray-200'
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] text-gray-400 tabular-nums lg:text-xs">
            {Math.min(stepIdx, total)}/{total}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 text-xs">
        <button
          type="button"
          aria-label="이전 정산 단계"
          disabled={stepIdx === 0 || activeIndex === 0}
          onClick={() => setSelectedStep(activeIndex - 1)}
          className="rounded border px-3 py-1 disabled:opacity-30"
        >
          ‹
        </button>
        <span>
          정산 단계 {stepIdx === 0 ? 0 : activeIndex + 1}/{total}
        </span>
        <button
          type="button"
          aria-label="다음 정산 단계"
          disabled={stepIdx === 0 || activeIndex >= stepIdx - 1}
          onClick={() => setSelectedStep(activeIndex + 1)}
          className="rounded border px-3 py-1 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <ul className="space-y-1.5 lg:space-y-2">
        {visible.map((step, i) => (
          <ResolveStepRow
            key={`${activeIndex}:${i}`}
            step={step}
            mySide={mySide}
            players={players}
          />
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────── */

function ResolveStepRow({
  step,
  mySide,
  players,
}: {
  step: SMS2ResolveStep;
  mySide: SMS2Side | null;
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
}) {
  const nick = (side: SMS2Side) => (mySide && side === mySide ? '나' : players[side].nickname);

  if (step.type === 'betReveal') {
    return (
      <li
        className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50"
        style={{ animation: 'sms2FadeIn 300ms ease-out forwards' }}
      >
        <div className="border-b border-amber-200 px-3 py-1.5 lg:px-4 lg:py-2">
          <span className="text-[11px] font-bold tracking-wide text-amber-600 uppercase lg:text-xs">
            🪙 베팅 공개
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-amber-100 px-2 py-2 lg:px-3 lg:py-3">
          <BetSummary label={`선 ${nick(step.firstSide)}`} bet={step.firstBet} />
          <BetSummary label={`후 ${nick(step.secondSide)}`} bet={step.secondBet} />
        </div>
      </li>
    );
  }

  if (step.type === 'litDecision') {
    const s = MARK_STYLES[step.litMark];
    return (
      <li
        className={`flex items-center gap-2 rounded-xl border ${s.borderLit} ${s.bgLit} px-3 py-2 lg:px-4 lg:py-2.5`}
        style={{ animation: 'sms2SlideIn 280ms ease-out forwards' }}
      >
        <span className="text-base lg:text-lg">{s.icon}</span>
        <span className={`text-xs font-extrabold lg:text-sm ${s.textLit}`}>{s.label} 점등</span>
      </li>
    );
  }

  if (step.type === 'payout') {
    const s = MARK_STYLES[step.mark];
    return (
      <li
        className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 lg:px-4 lg:py-2.5"
        style={{ animation: 'sms2SlideIn 280ms ease-out forwards' }}
      >
        <div className="flex items-center gap-1.5 text-xs text-emerald-800 lg:text-sm">
          <span className="text-base lg:text-lg">{s.icon}</span>
          <span>
            <b>{nick(step.side)}</b> {s.label} 베팅
          </span>
          <span className="text-emerald-600">× 2</span>
        </div>
        <div className="text-sm font-extrabold text-emerald-700 tabular-nums lg:text-base">
          +{step.returned} 칩
        </div>
      </li>
    );
  }

  if (step.type === 'forfeit') {
    const s = MARK_STYLES[step.mark];
    return (
      <li
        className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 lg:px-4 lg:py-2.5"
        style={{ animation: 'sms2SlideIn 280ms ease-out forwards' }}
      >
        <div className="flex items-center gap-1.5 text-xs text-rose-800 lg:text-sm">
          <span className="text-base lg:text-lg">{s.icon}</span>
          <span>
            <b>{nick(step.side)}</b> {s.label} 베팅 몰수
          </span>
        </div>
        <div className="text-sm font-extrabold text-rose-600 tabular-nums lg:text-base">
          -{step.amount} 칩
        </div>
      </li>
    );
  }

  if (step.type === 'powderBurn') {
    const s = MARK_STYLES[step.mark];
    return (
      <li
        className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 lg:px-4 lg:py-2.5"
        style={{ animation: 'sms2FadeIn 280ms ease-out forwards' }}
      >
        <span className="text-base lg:text-xl">🔥</span>
        <span className="text-xs text-orange-800 lg:text-sm">
          {s.icon} {s.label}의 빛가루 소멸
        </span>
      </li>
    );
  }

  if (step.type === 'roundSummary') {
    return (
      <li
        className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50"
        style={{ animation: 'sms2SlideIn 280ms ease-out forwards' }}
      >
        <div className="border-b border-indigo-200 px-3 py-1.5 lg:px-4 lg:py-2">
          <span className="text-[11px] font-bold tracking-wide text-indigo-500 uppercase lg:text-xs">
            📊 라운드 결과
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-indigo-100 px-2 py-2 lg:px-3 lg:py-3">
          <PlayerDelta
            label={nick('p1')}
            before={step.chipAfter.p1 - step.chipDelta.p1}
            after={step.chipAfter.p1}
            delta={step.chipDelta.p1}
          />
          <PlayerDelta
            label={nick('p2')}
            before={step.chipAfter.p2 - step.chipDelta.p2}
            after={step.chipAfter.p2}
            delta={step.chipDelta.p2}
          />
        </div>
      </li>
    );
  }
  return null;
}

/* ─────────────────────────────────────── */

function BetSummary({ label, bet }: { label: string; bet: SMS2ChipBet }) {
  const total = sumBet(bet);
  return (
    <div className="flex flex-col gap-1 px-2 lg:px-3">
      <div className="text-[11px] font-bold text-gray-500 lg:text-xs">{label}</div>
      <div className="flex items-center gap-1.5">
        {MARK_IDS.map((m) => {
          const ms = MARK_STYLES[m];
          const val = bet[m];
          return (
            <div
              key={m}
              className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold lg:text-xs ${
                val > 0 ? ms.chipSelf : 'bg-white/60 text-gray-400'
              }`}
            >
              {ms.icon}
              <span className="tabular-nums">{val}</span>
            </div>
          );
        })}
      </div>
      <div className="text-xs font-extrabold text-gray-700 tabular-nums lg:text-sm">
        총 {total}칩
      </div>
    </div>
  );
}

function PlayerDelta({
  label,
  before,
  after,
  delta,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
}) {
  const isPos = delta > 0;
  const isNeg = delta < 0;
  const deltaColor = isPos
    ? 'text-emerald-600 bg-emerald-100'
    : isNeg
      ? 'text-rose-600 bg-rose-100'
      : 'text-gray-500 bg-gray-100';

  return (
    <div className="flex flex-col items-center gap-1 px-2 lg:px-3">
      <div className="text-[11px] font-bold text-gray-500 lg:text-xs">{label}</div>
      <div className="text-xs text-gray-600 tabular-nums lg:text-sm">
        {before}
        <span className="mx-1 text-gray-400">→</span>
        <b className="text-gray-900">{after}</b>
        <span className="ml-0.5 text-[11px] text-gray-400 lg:text-xs">칩</span>
      </div>
      <div
        className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums lg:text-sm ${deltaColor}`}
      >
        {isPos ? `+${delta}` : `${delta}`}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
