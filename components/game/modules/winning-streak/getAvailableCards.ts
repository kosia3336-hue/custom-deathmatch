import type { WSCardCount, WSCardType } from '@/shared/types/winning-streak';
import { CARD_TYPES } from '@/shared/types/winning-streak';

export function getAvailableCards(cards: WSCardCount, lastPlayed: WSCardType | null): WSCardType[] {
  const available: WSCardType[] = [];
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    if (ct === lastPlayed) continue;
    available.push(ct);
  }
  if (available.length === 0 && lastPlayed && cards[lastPlayed] > 0) {
    available.push(lastPlayed);
  }
  return available;
}
