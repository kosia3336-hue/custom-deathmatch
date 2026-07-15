'use client';

import { useEffect, useState } from 'react';
import type { BankGameData, BankSide } from '@/shared/types/bank-game';
import { formatKRW } from './constants';

/* ════════════════════════════════════════════════════════════
 * ResolvePanel — reveal/roundEnd 순차 공개 애니메이션
 *
 *   Step 0 → 1 (300ms) : 선플 카드 슬라이드인 (장수만)
 *   Step 1 → 2 (800ms) : 후플 카드 슬라이드인 (장수만)
 *   Step 2 → 3 (700ms) : 금액 공개 팝
 *   Step 3 → 4 (700ms) : 결과 타이틀 + 점수 배너 팝
 *
 *   instant=true (roundEnd 재표시) → 즉시 step 4
 * ════════════════════════════════════════════════════════════ */

interface Props {
  gameData: BankGameData;
  mySide: BankSide | null;
  instant?: boolean;
}

export default function ResolvePanel({ gameData, mySide, instant = false }: Props) {
  const r = gameData.roundResult;
  const [step, setStep] = useState(instant ? 4 : 0);

  useEffect(() => {
    if (instant) { setStep(4); return; }
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1600);
    const t3 = setTimeout(() => setStep(3), 2800);
    const t4 = setTimeout(() => setStep(4), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  // round가 바뀌면 재실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.round, instant]);

  if (!r) return null;

  const isDraw = r.outcome === 'draw';
  const winnerSide = r.winnerSide;
  const firstSide = r.firstSide;
  const secondSide = firstSide === 'p1' ? 'p2' : 'p1';

  const titleText = step < 4
    ? null
    : isDraw
      ? '동률'
      : winnerSide === mySide
        ? '라운드 승리!'
        : winnerSide === null
          ? '결과'
          : '라운드 패배';

  const titleColor = isDraw
    ? 'text-gray-700'
    : winnerSide === mySide
      ? 'text-emerald-700'
      : 'text-rose-700';

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

      {/* 결과 타이틀 — step 4 */}
      <div
        className="text-center transition-all duration-500"
        style={{
          opacity: step >= 4 ? 1 : 0,
          transform: step >= 4 ? 'scale(1)' : 'scale(0.85)',
        }}
      >
        {titleText && (
          <p
            className={`text-lg font-bold ${titleColor}`}
            style={step >= 4 ? { animation: 'bankResultPop 0.45s ease-out' } : undefined}
          >
            {titleText}
          </p>
        )}
        <p className="text-[11px] text-gray-400">R{r.round} 정산</p>
      </div>

      {/* 2카드 그리드 */}
      <div className="grid grid-cols-2 gap-2">
        {([firstSide, secondSide] as const).map((side, idx) => {
          const isFirst = side === firstSide;
          const isMe = mySide === side;
          const isWinner = winnerSide === side;
          const player = gameData.players[side];
          const count = isFirst ? r.firstCount : r.secondCount;
          const amount = isFirst ? r.firstAmount : r.secondAmount;
          const auto = isFirst ? r.firstAuto : r.secondAuto;

          // 카드 등장 step: 선=step1, 후=step2
          const cardStep = idx === 0 ? 1 : 2;
          const cardVisible = step >= cardStep;

          const cardBg = step >= 4 && isWinner
            ? 'border-emerald-300 bg-emerald-50'
            : isMe
              ? 'border-indigo-200 bg-indigo-50'
              : 'border-amber-200 bg-amber-50';
          const accentText = isMe ? 'text-indigo-700' : 'text-amber-700';

          return (
            <div
              key={side}
              className={`flex flex-col gap-1 rounded-lg border-2 p-2 transition-all duration-500 ${cardBg}`}
              style={{
                opacity: cardVisible ? 1 : 0,
                transform: cardVisible
                  ? 'translateX(0)'
                  : idx === 0
                    ? 'translateX(-18px)'
                    : 'translateX(18px)',
              }}
            >
              {/* 닉네임 + 선/승자 뱃지 */}
              <div className="flex items-center gap-1">
                <p className={`truncate text-xs font-bold ${accentText}`}>
                  {player.nickname}
                  {isMe && <span className="ml-0.5 text-[10px] text-indigo-500">(나)</span>}
                </p>
              </div>

              {/* 장수 — 카드 등장 즉시 */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-gray-500">제출 장수</p>
                  <p className={`text-2xl font-extrabold tabular-nums ${accentText}`}>
                    {count}
                    <span className="ml-0.5 text-xs font-bold">장</span>
                  </p>
                </div>

                {/* 금액 — step 3 */}
                <div
                  className="text-right transition-all duration-400"
                  style={{
                    opacity: step >= 3 ? 1 : 0,
                    transform: step >= 3 ? 'scale(1)' : 'scale(0.7)',
                  }}
                >
                  <p className="text-[10px] text-gray-500">금액</p>
                  {amount == null ? (
                    <p className="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-[11px] font-bold text-gray-400">
                      비공개
                    </p>
                  ) : (
                    <p
                      className="text-base font-extrabold tabular-nums text-rose-700"
                      style={step === 3 ? { animation: 'bankAmountReveal 0.4s ease-out' } : undefined}
                    >
                      {formatKRW(amount)}
                      <span className="ml-0.5 text-[10px] font-bold">원</span>
                    </p>
                  )}
                </div>
              </div>

              {auto && (
                <p className="text-right text-[10px] text-amber-600">시간초과 자동제출</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 점수 + 패자 금액 배너 — step 4 */}
      <div
        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs transition-all duration-500"
        style={{
          opacity: step >= 4 ? 1 : 0,
          transform: step >= 4 ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        <span className="text-gray-600">
          승점{' '}
          <b className="tabular-nums text-gray-900">
            {r.scoreAfter.p1} : {r.scoreAfter.p2}
          </b>
        </span>
        {r.loserAmountThisRound != null && (
          <span className="text-rose-700">
            패자 금액{' '}
            <b className="tabular-nums">+{formatKRW(r.loserAmountThisRound)}원</b>
          </span>
        )}
      </div>
    </div>
  );
}
