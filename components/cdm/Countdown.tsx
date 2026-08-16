'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CountdownProps {
  /** 남은 초. 0 이하가 되면 onComplete 호출 */
  seconds: number;
  /** 다 되면 호출 */
  onComplete?: () => void;
  /** 표시 형식 */
  format?: 'mm:ss' | 'seconds' | 'verbose';
  /** 큰 폰트로 표시 */
  large?: boolean;
  className?: string;
  /** 마지막 10초 강조 끄기 */
  noPulse?: boolean;
}

function format(secondsLeft: number, mode: NonNullable<CountdownProps['format']>) {
  if (mode === 'seconds') return `${secondsLeft}s`;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const padded = `${mm}:${ss.toString().padStart(2, '0')}`;
  if (mode === 'verbose') return `${padded} 후 자동으로 이동합니다`;
  return padded;
}

/** 라이브 카운트다운 텍스트. 색은 §15.11 규칙. */
export function Countdown({
  seconds,
  onComplete,
  format: mode = 'mm:ss',
  large,
  className,
  noPulse,
}: CountdownProps) {
  const [left, setLeft] = React.useState(Math.max(0, Math.floor(seconds)));
  // 최신 콜백 보관. 렌더 중에 쓰면 순수하지 않아(동시 렌더에서 어긋난다) effect 로 미룬다.
  // 아래 두 사용처가 모두 effect·타이머 안이라 한 렌더 늦게 반영돼도 문제없다.
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  React.useEffect(() => {
    setLeft(Math.max(0, Math.floor(seconds)));
  }, [seconds]);

  React.useEffect(() => {
    if (left <= 0) {
      onCompleteRef.current?.();
      return;
    }
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onCompleteRef.current?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [left]);

  const tone =
    left <= 10
      ? noPulse
        ? 'text-cdm-accent'
        : 'cdm-countdown-critical'
      : left <= 30
        ? 'text-cdm-highlight'
        : 'text-cdm-fg-muted';

  return (
    <span
      role="timer"
      aria-live="polite"
      className={cn(
        'font-mono font-semibold tabular-nums',
        large ? 'text-3xl sm:text-4xl' : 'text-base',
        tone,
        className,
      )}
    >
      {format(left, mode)}
    </span>
  );
}
