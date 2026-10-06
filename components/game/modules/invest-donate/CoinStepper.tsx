'use client';

import { useCallback, useRef, useEffect } from 'react';

export default function CoinStepper({
  value,
  max,
  onChange,
  disabled,
  theme,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
  theme: 'invest' | 'donate';
}) {
  const repeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopRepeat(), [stopRepeat]);
  useEffect(() => {
    if (disabled) stopRepeat();
  }, [disabled, stopRepeat]);

  // 길게 누르기 반복에서 최신 값을 읽으려는 ref. 렌더 중 대입은 순수하지 않아 effect 로.
  const valueRef = useRef(value);
  const maxRef = useRef(max);
  useEffect(() => {
    valueRef.current = value;
    maxRef.current = max;
  });

  const handleDown = useCallback(
    (delta: number) => {
      stopRepeat();
      repeatTimeoutRef.current = setTimeout(() => {
        repeatIntervalRef.current = setInterval(() => {
          const next = Math.max(0, Math.min(maxRef.current, valueRef.current + delta));
          onChange(next);
        }, 100);
      }, 300);
    },
    [onChange, stopRepeat],
  );

  const bg = theme === 'invest' ? 'bg-blue-50' : 'bg-emerald-50';

  return (
    <div className={`flex items-center gap-0.5 ${bg} rounded px-0.5 py-0.5`}>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-30"
        disabled={disabled || value <= 0}
        onPointerDown={() => !disabled && handleDown(-1)}
        onClick={() => onChange(Math.max(0, Math.min(max, value - 1)))}
        aria-label="코인 줄이기"
        onPointerCancel={stopRepeat}
        onBlur={stopRepeat}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-bold text-gray-800 tabular-nums">{value}</span>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-30"
        disabled={disabled || value >= max}
        onPointerDown={() => !disabled && handleDown(1)}
        onClick={() => onChange(Math.max(0, Math.min(max, value + 1)))}
        aria-label="코인 늘리기"
        onPointerCancel={stopRepeat}
        onBlur={stopRepeat}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
      >
        +
      </button>
    </div>
  );
}
