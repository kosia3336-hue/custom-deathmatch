import type { WSCardCount, WSCardType } from '@/shared/types/winning-streak';
import { CARD_TYPES } from '@/shared/types/winning-streak';

export function getCardEntries(cards: WSCardCount): { type: WSCardType; count: number }[] {
  return CARD_TYPES.map((ct) => ({ type: ct, count: cards[ct] }));
}
