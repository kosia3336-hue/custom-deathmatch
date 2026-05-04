'use client';

import { cn } from '@/lib/utils';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** 슬라이더 좌측 아이콘 */
  leftAdornment?: React.ReactNode;
  /** 슬라이더 우측 아이콘 */
  rightAdornment?: React.ReactNode;
  /** 우측 값 표시 (예: "30%") */
  valueLabel?: string;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled,
  ariaLabel,
  className,
  leftAdornment,
  rightAdornment,
  valueLabel,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        disabled && 'opacity-50',
        className,
      )}
    >
      {leftAdornment ? (
        <span className="shrink-0 text-cdm-fg-muted" aria-hidden>
          {leftAdornment}
        </span>
      ) : null}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cdm-slider h-2 flex-1 cursor-pointer appearance-none rounded-full bg-cdm-bg-elev-2 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, var(--cdm-primary, #4F46E5) 0%, var(--cdm-primary, #4F46E5) ${pct}%, var(--cdm-bg-elev-2, #F1F5F9) ${pct}%, var(--cdm-bg-elev-2, #F1F5F9) 100%)`,
        }}
      />

      {rightAdornment ? (
        <span className="shrink-0 text-cdm-fg-muted" aria-hidden>
          {rightAdornment}
        </span>
      ) : null}

      {valueLabel ? (
        <span className="w-10 shrink-0 text-right font-mono text-xs text-cdm-fg-muted tabular-nums">
          {valueLabel}
        </span>
      ) : null}

      <style jsx>{`
        .cdm-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--cdm-primary, #4f46e5);
          border: 2px solid var(--cdm-bg, #ffffff);
          box-shadow: 0 0 0 1px var(--cdm-border, #e2e8f0);
          cursor: pointer;
          transition: transform 120ms ease;
        }
        .cdm-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .cdm-slider:focus {
          outline: none;
        }
        .cdm-slider:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px var(--cdm-ring-primary, rgba(79, 70, 229, 0.3));
        }
        .cdm-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--cdm-primary, #4f46e5);
          border: 2px solid var(--cdm-bg, #ffffff);
          box-shadow: 0 0 0 1px var(--cdm-border, #e2e8f0);
          cursor: pointer;
        }
        .cdm-slider:disabled::-webkit-slider-thumb {
          cursor: not-allowed;
        }
        @media (max-width: 767px) {
          .cdm-slider::-webkit-slider-thumb {
            width: 24px;
            height: 24px;
          }
          .cdm-slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>
    </div>
  );
}
