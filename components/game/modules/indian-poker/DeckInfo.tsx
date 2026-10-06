'use client';

interface DeckInfoProps {
  deckRemaining: number;
  deckCycle: number;
  ante: number;
  pot: number;
}

export default function DeckInfo({ deckRemaining, deckCycle, ante, pot }: DeckInfoProps) {
  return (
    <div
      aria-label="판 정보"
      className="text-cdm-ink-fg-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs"
    >
      <span>
        남은 덱 <strong className="text-cdm-ink-fg tabular-nums">{deckRemaining}</strong>
      </span>
      {deckCycle > 1 && <span>리셋 {deckCycle - 1}회</span>}
      <span>
        앤트 <strong className="text-cdm-ink-fg tabular-nums">{ante}</strong>
      </span>
      <span>
        팟 <strong className="text-cdm-highlight tabular-nums">{pot}</strong>
      </span>
    </div>
  );
}
