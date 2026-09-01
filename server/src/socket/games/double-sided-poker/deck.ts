import type { DoubleSidedPokerCard } from '@shared/types/double-sided-poker.js';

const VALUES = Array.from({ length: 10 }, (_, index) => index + 1);

export function createDoubleSidedPokerDeck(): DoubleSidedPokerCard[] {
  return Array.from({ length: 4 }, (_, setIndex) => setIndex + 1).flatMap((set) =>
    VALUES.flatMap((front) =>
      VALUES.filter((back) => back % 2 !== front % 2).map((back) => ({
        id: `${set}-${front}-${back}`,
        set,
        front,
        back,
      })),
    ),
  );
}

export function shuffleDoubleSidedPokerDeck(
  deck = createDoubleSidedPokerDeck(),
): DoubleSidedPokerCard[] {
  const shuffled = deck.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
