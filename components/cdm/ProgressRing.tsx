import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './progress-ring.module.css';

/** 시간/진행률을 아는 경우 value(0~100), 모르는 로딩은 회전하는 막대를 사용한다. */
export function ProgressRing({
  value,
  size = 32,
  label,
  children,
  className,
}: {
  value?: number;
  size?: number;
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const progress = value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return (
    <span
      className={cn(styles.ring, 'text-cdm-primary', className)}
      style={{ width: size, height: size }}
      role={progress === undefined ? 'status' : 'progressbar'}
      aria-label={label}
      aria-valuemin={progress === undefined ? undefined : 0}
      aria-valuemax={progress === undefined ? undefined : 100}
      aria-valuenow={progress === undefined ? undefined : Math.round(progress)}
    >
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className={progress === undefined ? styles.spinning : undefined}
      >
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.15"
        />
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={progress === undefined ? 72 : 100 - progress}
          transform="rotate(-90 20 20)"
          className={styles.bar}
        />
      </svg>
      {children && <span className={styles.center}>{children}</span>}
    </span>
  );
}
