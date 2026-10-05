'use client';

import { useCardRevealSound } from '@/hooks/useGameAudio';
import type { CSSProperties } from 'react';
import type { SeedSeotdaCard as SeedSeotdaCardData } from '@/shared/types/seed-seotda';
import { cn } from '@/lib/utils';
import styles from './SeedSeotdaCard.module.css';

export type SeedSeotdaCardSize = 'tiny' | 'full' | 'sm' | 'md' | 'lg';

const COLUMNS = 6;
const ROWS = 4;
const BACK_INDEX = 20;

function spriteIndex(card: SeedSeotdaCardData | null, hidden: boolean) {
  if (!card || hidden) return BACK_INDEX;
  return (card.month - 1) * 2 + (card.variant === 'b' ? 1 : 0);
}

export default function SeedSeotdaCard({
  card,
  hidden = false,
  size = 'md',
  className,
  ariaLabel,
}: {
  card: SeedSeotdaCardData | null;
  hidden?: boolean;
  size?: SeedSeotdaCardSize;
  className?: string;
  ariaLabel?: string;
}) {
  const index = spriteIndex(card, hidden);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const isFace = index !== BACK_INDEX;
  useCardRevealSound(isFace, card?.id ?? 'back');
  const style: CSSProperties = {
    backgroundPosition: `${(column / (COLUMNS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
  };

  /*
    월을 왼쪽 위에 겹쳐 적는다. 화투 그림만으로는 몇 월인지 바로 안 읽히는데,
    섯다는 월의 조합으로 족보가 정해지므로 숫자가 보여야 한다.
    뒷면에는 적지 않는다.
  */
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (isFace ? `${card?.month}월 ${card?.variant} 카드` : '카드 뒷면')}
      className={cn(styles.card, styles[size], className)}
      style={style}
      data-card-id={isFace ? card?.id : 'back'}
    >
      {isFace && card && <span className={styles.month}>{card.month}</span>}
    </span>
  );
}
