import type { SeedSeotdaCard } from '@shared/types/seed-seotda.js';
import { createSeedSeotdaDeck } from '@shared/logic/seed-seotda.js';

/* 덱 구성은 화면도 써야 해서 공용으로 옮겼다(shared/logic/seed-seotda.ts). */
export { createSeedSeotdaDeck };

export function shuffleSeedSeotdaDeck(deck = createSeedSeotdaDeck()): SeedSeotdaCard[] {
  const shuffled = deck.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
