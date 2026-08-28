import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './abstract-board-3d.module.css';

export interface Board3DProps {
  columns: number;
  rows?: number;
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  frameClassName?: string;
  gridClassName?: string;
  maxWidth?: CSSProperties['maxWidth'];
  density?: 'compact' | 'comfortable';
  tilt?: boolean;
}

/**
 * 추상전략 게임이 공유하는 입체 판 프레임.
 * 게임별 규칙은 알지 못하며 열·행 수와 칸 컴포넌트만 전달받는다.
 */
export function Board3D({
  columns,
  rows = columns,
  children,
  ariaLabel,
  className,
  frameClassName,
  gridClassName,
  maxWidth = '36rem',
  density = 'comfortable',
  tilt = true,
}: Board3DProps) {
  return (
    <div className={cn(styles.scene, className)} style={{ maxWidth }}>
      <div
        className={cn(styles.frame, frameClassName)}
        data-density={density}
        data-tilt={tilt ? 'true' : 'false'}
        style={{ aspectRatio: `${columns} / ${rows}` }}
      >
        <div
          className={cn(styles.grid, gridClassName)}
          role="group"
          aria-label={ariaLabel}
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
