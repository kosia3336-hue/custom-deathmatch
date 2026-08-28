import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './game-piece-3d.module.css';

export type GamePiece3DTone = 'primary' | 'highlight' | 'dark' | 'light' | 'neutral' | 'danger';

export type GamePiece3DShape = 'disc' | 'crown' | 'tile';

export interface GamePiece3DProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone?: GamePiece3DTone;
  shape?: GamePiece3DShape;
  label?: ReactNode;
  selected?: boolean;
  decorative?: boolean;
}

/** 원형 돌·특수말·타일을 같은 광원과 깊이로 표현하는 공통 게임말. */
export function GamePiece3D({
  tone = 'neutral',
  shape = 'disc',
  label,
  selected = false,
  decorative = true,
  className,
  role,
  ...props
}: GamePiece3DProps) {
  return (
    <span
      {...props}
      className={cn(styles.piece, className)}
      data-tone={tone}
      data-shape={shape}
      data-selected={selected ? 'true' : 'false'}
      role={decorative ? undefined : (role ?? 'img')}
      aria-hidden={decorative ? true : undefined}
    >
      {label != null && <span className={styles.label}>{label}</span>}
    </span>
  );
}
