'use client';
import type { WSCardCount, WSCardType } from '@/shared/types/winning-streak';
import { CARD_COLORS } from './constants';
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
    <div className="border-cdm-border bg-cdm-bg-elev-1 rounded-lg border px-3 py-2">
      {label && (
        <p className="text-cdm-fg-muted mb-1.5 text-xs font-medium uppercase lg:text-sm">{label}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {entries.map(({ type, count }) => {
          const style = CARD_COLORS[type];
          const isLocked = type === lastPlayed;
          const isEmpty = count <= 0;
          return (
            <div
              key={type}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium lg:text-sm ${
                isEmpty
                  ? 'bg-gray-100 text-gray-300 line-through'
                  : isLocked
                    ? 'bg-gray-200 text-gray-500 ring-1 ring-red-300'
                    : `${style.bg} ${style.text}`
              }`}
            >
              <span>{style.icon}</span>
              <span className="font-mono font-bold">×{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
