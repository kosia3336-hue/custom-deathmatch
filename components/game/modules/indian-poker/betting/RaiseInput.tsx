'use client';

import { useState } from 'react';
import { clampIndianPokerRaise, type IndianPokerBettingLimits } from '@/shared/indianPokerBetting';

export default function RaiseInput({
  limits,
  onCancel,
  onConfirm,
}: {
  limits: IndianPokerBettingLimits;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(String(limits.minRaise));
  const parsed = Number(draft);
  const valid =
    draft.trim() !== '' &&
    Number.isInteger(parsed) &&
    parsed >= limits.minRaise &&
    parsed <= limits.maxRaise;
  const amount = Number.isFinite(parsed) ? clampIndianPokerRaise(parsed, limits) : limits.minRaise;
  const choose = (value: number) => setDraft(String(clampIndianPokerRaise(value, limits)));
  return (
    <div className="ip-raise-input">
      <div className="ip-raise-top">
        <label htmlFor="ip-raise-amount">레이즈</label>
        <div className="ip-raise-stepper">
          <button
            type="button"
            aria-label="레이즈 1칩 줄이기"
            disabled={amount <= limits.minRaise}
            onClick={() => choose(amount - 1)}
          >
            −
          </button>
          <input
            id="ip-raise-amount"
            aria-label="레이즈 금액"
            type="number"
            inputMode="numeric"
            step={1}
            min={limits.minRaise}
            max={limits.maxRaise}
            value={draft}
            aria-invalid={!valid}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            aria-label="레이즈 1칩 늘리기"
            disabled={amount >= limits.maxRaise}
            onClick={() => choose(amount + 1)}
          >
            +
          </button>
        </div>
        <div className="ip-raise-presets">
          {[1, 3, 5].map((step) => (
            <button type="button" key={step} onClick={() => choose(amount + step)}>
              +{step}
            </button>
          ))}
          <button type="button" onClick={() => choose(limits.maxRaise)}>
            올인
          </button>
        </div>
      </div>
      <div className="ip-raise-slider">
        <span>최소 {limits.minRaise}</span>
        <input
          type="range"
          aria-label="레이즈 금액 슬라이더"
          min={limits.minRaise}
          max={limits.maxRaise}
          step={1}
          value={amount}
          onChange={(e) => choose(Number(e.target.value))}
        />
        <span>올인 {limits.maxRaise}</span>
      </div>
      <div className="ip-raise-confirm">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className="ip-betting-primary"
          disabled={!valid || !limits.canRaise}
          onClick={() => onConfirm(parsed)}
        >
          {valid ? `${parsed}칩 레이즈` : '금액 확인'}
        </button>
      </div>
    </div>
  );
}
