'use client';
import type { WSCardCount, WSCardType } from '@/shared/types/winning-streak';
import { CARD_NAMES } from './constants';
import { WinningStreakCard } from './WinningStreakCard';
import styles from './winning-streak.module.css';
import { getCardEntries } from './getCardEntries';

export function MyCardHand({
  cards,
  lastPlayed,
  available,
  onCardClick,
  canAct,
  submitted,
}: {
  cards: WSCardCount;
  lastPlayed: WSCardType | null;
  available: WSCardType[];
  onCardClick: (type: WSCardType, index: number, isLocked: boolean) => void;
  canAct: boolean;
  submitted: boolean;
}) {
  const entries = getCardEntries(cards);

  return (
    <div className={styles.hand}>
      <p className="mb-1.5 text-center text-[11px] font-medium text-gray-500 lg:text-sm">
        {submitted ? '제출 완료 — 상대를 기다리는 중...' : '카드를 눌러 선택하세요'}
      </p>
      <div className={styles.cardGrid}>
        {entries.map(({ type, count }) => {
          if (count <= 0) return null;
          const isLocked = type === lastPlayed && !available.includes(type);
          const isAvailable = available.includes(type);

          return Array.from({ length: count }, (_, i) => (
            <button
              key={`${type}-${i}`}
              onClick={() => canAct && !submitted && onCardClick(type, i, isLocked)}
              type="button"
              aria-label={`${CARD_NAMES[type]} ${i + 1}`}
              disabled={!canAct || submitted}
              className={`rounded-xl transition-transform select-none ${
                isLocked
                  ? 'cursor-pointer opacity-50'
                  : isAvailable && canAct && !submitted
                    ? 'cursor-pointer shadow-sm hover:-translate-y-1 hover:shadow-lg active:scale-95'
                    : 'cursor-not-allowed opacity-40'
              }`}
            >
              <WinningStreakCard card={type} />
            </button>
          ));
        })}
      </div>
    </div>
  );
}
