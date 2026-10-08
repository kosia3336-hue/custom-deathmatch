export interface PokerTableInfoProps {
  deckRemaining?: number;
  deckCycle?: number;
  ante: number;
  pot: number;
}

/** 상단 바의 팟·덱·앤티 표시를 포커 게임에서 같은 모양으로 사용한다. */
export function PokerTableInfo({ deckRemaining, deckCycle = 1, ante, pot }: PokerTableInfoProps) {
  return (
    <div
      aria-label="판 정보"
      className="text-cdm-ink-fg-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs"
    >
      {deckRemaining != null && (
        <span>
          남은 덱 <strong className="text-cdm-ink-fg tabular-nums">{deckRemaining}</strong>
        </span>
      )}
      {deckCycle > 1 && <span>리셋 {deckCycle - 1}회</span>}
      <span>
        앤티 <strong className="text-cdm-ink-fg tabular-nums">{ante}</strong>
      </span>
      <span>
        팟 <strong className="text-cdm-highlight tabular-nums">{pot}</strong>
      </span>
    </div>
  );
}
