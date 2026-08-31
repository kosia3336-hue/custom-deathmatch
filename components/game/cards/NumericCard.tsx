import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import styles from './NumericCard.module.css';

export type NumericCardSize = 'tiny' | 'sm' | 'md';

interface NumericCardProps {
  value: number | null;
  hidden?: boolean;
  size?: NumericCardSize;
  animateIn?: boolean;
  className?: string;
  ariaLabel?: string;
}

const COLUMNS = 6;
const BACK_INDEX = 10;

function getSpriteIndex(value: number | null, hidden: boolean) {
  if (
    hidden
    || value === null
    || !Number.isInteger(value)
    || value < 1
    || value > 10
  ) {
    return BACK_INDEX;
  }

  return value - 1;
}

export default function NumericCard({
  value,
  hidden = false,
  size = 'md',
  animateIn = false,
  className,
  ariaLabel,
}: NumericCardProps) {
  const index = getSpriteIndex(value, hidden);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const isFace = index !== BACK_INDEX;
  const style: CSSProperties = {
    backgroundPosition: `${column * 20}% ${row * 100}%`,
  };

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (isFace ? `숫자 ${value} 카드` : '카드 뒷면')}
      className={cn(
        styles.card,
        styles[size],
        animateIn && styles.revealing,
        className,
      )}
      style={style}
      data-card-value={isFace ? value : 'back'}
    />
  );
}
