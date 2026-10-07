import type { WSCardType } from '@/shared/types/winning-streak';
import { CARD_COLORS, CARD_NAMES } from './constants';
import styles from './winning-streak.module.css';

/** 공개 화면과 손패·선택 미리보기·잔여 카드가 공유하는 카드 원본. */
export function WinningStreakCard({ card }: { card: WSCardType }) {
  const color = CARD_COLORS[card];
  return (
    <div data-ws-card={card} className={`${styles.card} ${color.bg} ${color.text} ${color.border}`}>
      <span className={styles.symbol}>{color.icon}</span>
      <span className={styles.name}>{CARD_NAMES[card]}</span>
    </div>
  );
}
