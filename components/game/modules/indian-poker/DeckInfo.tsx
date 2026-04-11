'use client';

interface DeckInfoProps {
  deckRemaining: number;
  deckCycle: number;
  ante: number;
  round: number;
}

export default function DeckInfo({ deckRemaining, deckCycle, ante, round }: DeckInfoProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 lg:text-sm">
      <span>R{round}</span>
      <span>덱: {deckRemaining}장</span>
      {deckCycle > 1 && <span>리셋 {deckCycle - 1}회</span>}
      <span>앤트: {ante}</span>
    </div>
  );
}
