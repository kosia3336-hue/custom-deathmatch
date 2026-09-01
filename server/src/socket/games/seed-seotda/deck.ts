import type {
  SeedSeotdaCard,
  SeedSeotdaCardKind,
  SeedSeotdaCardVariant,
  SeedSeotdaMonth,
} from '@shared/types/seed-seotda.js';

const FIRST_CARD_KIND: Record<SeedSeotdaMonth, SeedSeotdaCardKind> = {
  1: 'bright',
  2: 'animal',
  3: 'bright',
  4: 'animal',
  5: 'animal',
  6: 'animal',
  7: 'animal',
  8: 'bright',
  9: 'animal',
  10: 'animal',
};

export function createSeedSeotdaDeck(): SeedSeotdaCard[] {
  return Array.from({ length: 10 }, (_, index) => (index + 1) as SeedSeotdaMonth).flatMap((month) =>
    (['a', 'b'] as SeedSeotdaCardVariant[]).map((variant) => ({
      id: `${month}${variant}`,
      month,
      variant,
      kind: variant === 'a' ? FIRST_CARD_KIND[month] : month === 8 ? 'animal' : 'ribbon',
    })),
  );
}

export function shuffleSeedSeotdaDeck(deck = createSeedSeotdaDeck()): SeedSeotdaCard[] {
  const shuffled = deck.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
