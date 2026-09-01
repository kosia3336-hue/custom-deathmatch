import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import styles from './DoubleSidedPokerCard.module.css';

export type DoubleSidedPokerCardSize = 'tiny' | 'sm' | 'md' | 'lg';
export type DoubleSidedPokerCardFace = 'front' | 'back' | 'hidden';

const COLUMNS = 6;
const ROWS = 4;
const HIDDEN_INDEX = 20;

function spriteIndex(value: number | null, face: DoubleSidedPokerCardFace) {
  if (face === 'hidden' || value == null) return HIDDEN_INDEX;
  const safeValue = Math.min(10, Math.max(1, Math.trunc(value)));
  return (face === 'back' ? 10 : 0) + safeValue - 1;
}

export default function DoubleSidedPokerCard({
  value,
  face,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: number | null;
  face: DoubleSidedPokerCardFace;
  size?: DoubleSidedPokerCardSize;
  className?: string;
  ariaLabel?: string;
}) {
  const index = spriteIndex(value, face);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const style: CSSProperties = {
    backgroundPosition: `${(column / (COLUMNS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
  };
  const label =
    face === 'hidden' || value == null
      ? '비공개 카드 뒷면'
      : `${face === 'front' ? '앞면' : '뒷면'} 숫자 ${value}`;
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? label}
      className={cn(styles.card, styles[size], className)}
      style={style}
      data-card-face={face}
      data-card-value={value ?? undefined}
    />
  );
}
