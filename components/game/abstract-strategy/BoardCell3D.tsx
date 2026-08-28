import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './abstract-board-3d.module.css';

export type BoardCell3DTone = 'light' | 'dark' | 'plain';
export type BoardCell3DState = 'idle' | 'selected' | 'available' | 'highlight' | 'danger';

interface CellSurfaceProps {
  children?: ReactNode;
  tone?: BoardCell3DTone;
  state?: BoardCell3DState;
  className?: string;
}

function cellClassName({
  state = 'idle',
  className,
}: Pick<CellSurfaceProps, 'state' | 'className'>) {
  return cn(styles.cell, className, state !== 'idle' && styles.cellEmphasized);
}

/** 기록 뷰어처럼 클릭하지 않는 판에 쓰는 정적 칸. */
export function BoardCell3D({
  children,
  tone = 'light',
  state = 'idle',
  className,
  ...props
}: CellSurfaceProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cellClassName({ state, className })}
      data-tone={tone}
      data-state={state}
    >
      <span className={styles.cellContent}>{children}</span>
    </div>
  );
}

/** 실제 게임에서 클릭하는 판에 쓰는 버튼 칸. */
export function BoardCellButton3D({
  children,
  tone = 'light',
  state = 'idle',
  className,
  type = 'button',
  ...props
}: CellSurfaceProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={type}
      className={cn(cellClassName({ state, className }), styles.cellButton)}
      data-tone={tone}
      data-state={state}
    >
      <span className={styles.cellContent}>{children}</span>
    </button>
  );
}
