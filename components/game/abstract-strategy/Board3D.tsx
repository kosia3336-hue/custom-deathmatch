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
  /**
   * 남은 높이에 맞춰 판을 줄인다. GameFrame 의 무대 안에서만 뜻이 있다 —
   * 무대가 container-type: size 라서 100cqh 가 '남은 높이' 로 읽힌다.
   * 화면 높이(dvh)로 어림잡지 말 것. 머리말·조작부 높이는 게임마다 다르다.
   */
  fit?: boolean;
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
  fit = false,
}: Board3DProps) {
  /*
    scene 높이 = 판 높이 + scene 아래 여백이고, 판 높이 = (scene 너비 - 좌우 여백) / 비율.
    이걸 100cqh 이하로 누르면 아래 식이 나온다. 여백은 clamp 의 최댓값으로 빼서
    조금 작게 잡는다 — 넘치는 쪽보다 남는 쪽이 낫다.
  */
  const ratio = columns / rows;
  const fitWidth = `calc((100cqh - 1.15rem) * ${ratio} + 1rem)`;

  return (
    <div
      className={cn(styles.scene, className)}
      style={{ maxWidth: fit ? `min(${maxWidth}, ${fitWidth})` : maxWidth }}
    >
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
