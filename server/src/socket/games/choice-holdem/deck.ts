import type { ChoiceHoldemCard } from '@shared/types/choice-holdem.js';

export function createChoiceHoldemDeck(): ChoiceHoldemCard[] {
  return ([1, 2, 3, 4, 5] as ChoiceHoldemCard[]).flatMap((card) =>
    Array.from({ length: 4 }, () => card),
  );
}

export function shuffleChoiceHoldemDeck(deck = createChoiceHoldemDeck()): ChoiceHoldemCard[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
