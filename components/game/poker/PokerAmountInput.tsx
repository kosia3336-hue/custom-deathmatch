'use client';

import { useState, useId } from 'react';

export function PokerAmountInput({
  title = '레이즈',
  min,
  max,
  enabled = true,
  initialAmount = min,
  maximumLabel = '최대',
  cancelLabel = '취소',
  cancelClassName,
  cancelPosition = 'left',
  onCancel,
  onConfirm,
  onPreview,
  confirmLabel,
}: {
  title?: string;
  min: number;
  max: number;
  enabled?: boolean;
  initialAmount?: number;
  maximumLabel?: string;
  cancelLabel?: string;
  cancelClassName?: string;
  cancelPosition?: 'left' | 'right';
  onCancel: () => void;
  onConfirm: (amount: number) => void;
  onPreview?: (amount: number) => void;
  confirmLabel: (amount: number) => string;
}) {
  const inputId = useId();
  const clamp = (value: number) => Math.max(min, Math.min(max, Math.round(value)));
  const [draft, setDraft] = useState(String(initialAmount));
  const parsed = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max;
  const amount = Number.isFinite(parsed) ? clamp(parsed) : min;
  const choose = (value: number) => {
    const next = clamp(value);
    setDraft(String(next));
    onPreview?.(next);
  };
  const cancelButton = (
    <button type="button" className={cancelClassName} onClick={onCancel}>
      {cancelLabel}
    </button>
  );
  return (
    <div className="ip-raise-input">
      <div className="ip-raise-top">
        <label htmlFor={inputId}>{title}</label>
        <div className="ip-raise-stepper">
          <button
            type="button"
            aria-label={`${title} 1칩 줄이기`}
            disabled={amount <= min}
            onClick={() => choose(amount - 1)}
          >
            −
          </button>
          <input
            id={inputId}
            aria-label={`${title} 금액`}
            type="number"
            inputMode="numeric"
            step={1}
            min={min}
            max={max}
            value={draft}
            aria-invalid={!valid}
            onChange={(e) => {
              setDraft(e.target.value);
              const next = Number(e.target.value);
              if (Number.isFinite(next)) onPreview?.(clamp(next));
            }}
          />
          <button
            type="button"
            aria-label={`${title} 1칩 늘리기`}
            disabled={amount >= max}
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
          <button type="button" onClick={() => choose(max)}>
            {maximumLabel}
          </button>
        </div>
      </div>
      <div className="ip-raise-slider">
        <span>최소 {min}</span>
        <input
          type="range"
          aria-label={`${title} 금액 슬라이더`}
          min={min}
          max={max}
          step={1}
          value={amount}
          onChange={(e) => choose(Number(e.target.value))}
        />
        <span>
          {maximumLabel} {max}
        </span>
      </div>
      <div className="ip-raise-confirm" data-cancel-position={cancelPosition}>
        {cancelPosition === 'left' && cancelButton}
        <button
          type="button"
          className="ip-betting-primary"
          disabled={!valid || !enabled}
          onClick={() => onConfirm(parsed)}
        >
          {valid ? confirmLabel(parsed) : '금액 확인'}
        </button>
        {cancelPosition === 'right' && cancelButton}
      </div>
    </div>
  );
}
