'use client';

import { cn } from '@/lib/utils';
import type { ColorId, RtbCard } from '@shared/guild-war';
import { COLOR_LABEL } from '@shared/guild-war';
import styles from './rtb-card.module.css';

const COLOR_CLASS: Record<ColorId, string> = {
  red: styles.red,
  orange: styles.orange,
  yellow: styles.yellow,
  green: styles.green,
  blue: styles.blue,
  purple: styles.purple,
};

export function RtbCard({
  card,
  hidden = false,
  selected = false,
  dimmed = false,
  playable = false,
  size = 'play',
  count,
  onClick,
}: {
  card: RtbCard | null;
  hidden?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  playable?: boolean;
  size?: 'play' | 'sm';
  count?: number;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  const isBack = hidden || !card;

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        styles.card,
        size === 'sm' && styles.sm,
        isBack ? styles.back : cn(styles.face, COLOR_CLASS[card.color]),
        onClick && styles.clickable,
        selected && styles.selected,
        dimmed && styles.dimmed,
        playable && styles.playable,
      )}
      aria-label={isBack ? (count != null ? `덱 잔여 ${count}장` : '뒷면') : `${COLOR_LABEL[card.color]} ${card.rank}`}
      aria-pressed={onClick ? selected : undefined}
    >
      {isBack ? (
        count != null ? (
          <span className={styles.backCount}>{count}</span>
        ) : (
          <span className={styles.backPip} aria-hidden />
        )
      ) : (
        <span className={styles.rank}>{card.rank}</span>
      )}
    </Comp>
  );
}
