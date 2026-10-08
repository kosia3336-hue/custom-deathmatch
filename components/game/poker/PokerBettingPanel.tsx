import type { ReactNode } from 'react';
import styles from './poker-betting.module.css';

/** 인디언홀덤Q와 양면 포커가 공유하는 베팅판 디자인. 행동 규칙은 각 게임에 둔다. */
export function PokerBettingPanel({ children }: { children: ReactNode }) {
  return (
    <section aria-label="플레이어 조작판" className={styles.bettingPanel}>
      {children}
    </section>
  );
}
