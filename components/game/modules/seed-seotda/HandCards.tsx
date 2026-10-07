'use client';
import { SeedSeotdaCard } from '@/components/game/cards';
import type { SeedSeotdaPlayerView } from '@/shared/types/seed-seotda';

export function HandCards({ player }: { player: SeedSeotdaPlayerView }) {
  const cards = player.finalHand.length > 0 ? player.finalHand : player.cards;
  const visibleCards = cards.length > 0 ? cards : [null, null];
  return (
    <div className="mt-2 flex justify-center gap-1 sm:gap-2 lg:mt-0">
      {visibleCards.map((card, index) => (
        <SeedSeotdaCard key={index} card={card} size="sm" />
      ))}
    </div>
  );
}
