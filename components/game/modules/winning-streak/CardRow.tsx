'use client';
import type { WSCardCount, WSCardType } from '@/shared/types/winning-streak';
import { WinningStreakCard } from './WinningStreakCard';
import styles from './winning-streak.module.css';
import { getCardEntries } from './getCardEntries';

export function CardRow({
  cards,
  lastPlayed,
  label,
}: {
  cards: WSCardCount;
  lastPlayed: WSCardType | null;
  label: string;
}) {
  const entries = getCardEntries(cards);
  return (
    <div>
      {label && (
        <p className="text-cdm-fg-muted mb-1.5 text-xs font-medium uppercase lg:text-sm">{label}</p>
      )}
      <div className={`${styles.cardGrid} ${styles.remainingGrid}`}>
        {entries.map(({ type, count }) => {
          const isLocked = type === lastPlayed;
          const isEmpty = count <= 0;
          return (
            <div
              key={type}
              className={`flex flex-col items-center gap-1 ${isEmpty ? 'opacity-30' : isLocked ? 'opacity-50' : ''}`}
            >
              <WinningStreakCard card={type} />
              <span className="text-cdm-fg-muted text-xs font-bold tabular-nums">
                ×{count}
                {isLocked && !isEmpty ? ' · 연속 불가' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
