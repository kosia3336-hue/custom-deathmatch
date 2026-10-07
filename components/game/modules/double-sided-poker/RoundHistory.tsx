'use client';

import { PlayingCard } from '@/components/game/cards';
import type { DoubleSidedPokerRoundResult } from '@/shared/types/double-sided-poker';
import { SELECTION_LABEL } from './presentation';

/** 서버가 시청자별로 가린 결과만 사용한다. 비공개 뒷면은 추측해서 채우지 않는다. */
export function RoundHistory({
  rounds,
  players,
  myId,
}: {
  rounds: DoubleSidedPokerRoundResult[];
  players: Record<string, { nickname: string }>;
  myId: string;
}) {
  if (!rounds.length) return <p className="text-xs">아직 완료된 라운드가 없습니다.</p>;
  return (
    <div className="flex flex-col gap-2">
      {[...rounds].reverse().map((round) => (
        <section
          key={round.round}
          className="border-cdm-border bg-cdm-bg text-cdm-fg rounded-lg border p-2 text-xs"
        >
          <p className="mb-2 font-bold">
            R{round.round} · 팟 {round.potAmount} ·{' '}
            {round.reason === 'tie'
              ? '무승부'
              : `${players[round.winnerId ?? '']?.nickname ?? '상대'} 승리`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(round.cards)
              .sort(([a], [b]) => Number(b === myId) - Number(a === myId))
              .map(([id, card]) => (
                <div key={id}>
                  <p className="mb-1 truncate">
                    {players[id]?.nickname ?? '상대'}
                    {id === myId && ' (나)'} ·{' '}
                    {round.selections[id] ? SELECTION_LABEL[round.selections[id]!] : '다이'}
                  </p>
                  <div className="flex gap-1">
                    <PlayingCard value={card.front} face="front" size="sm" />
                    {card.back != null ? (
                      <PlayingCard value={card.back} face="back" size="sm" />
                    ) : (
                      <span
                        className="border-cdm-border bg-cdm-bg-elev-2 flex aspect-[60/83] w-10 items-center justify-center rounded border"
                        aria-label="비공개 뒷면"
                      >
                        ?
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
