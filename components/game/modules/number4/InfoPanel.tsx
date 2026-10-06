'use client';

import type { NumberFourGameData } from '@/shared/types/number4';
import RoundHistory from './RoundHistory';
import { TileCount } from './Presentation';
import type { NumberFourRoundNotes } from '@/lib/numberFourNotes';

export default function InfoPanel({
  gameData,
  myId,
  predictions,
  compact,
  notes,
}: {
  gameData: NumberFourGameData;
  myId: string;
  predictions: Record<string, { white: number; black: number }>;
  compact: boolean;
  notes: NumberFourRoundNotes;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <section aria-label="점수와 잔여 타일" className="grid shrink-0 grid-cols-2 gap-2">
        {Object.entries(gameData.players).map(([id, p]) => {
          const predicted = predictions[id];
          return (
            <div
              key={id}
              className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg min-w-0 rounded-lg border px-2 py-1.5 sm:px-3"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-semibold">
                  {p.nickname}
                  {id === myId ? ' (나)' : ''}
                </span>
                <strong className={`shrink-0 tabular-nums ${p.score <= 1 ? 'text-red-500' : ''}`}>
                  {p.score}점
                </strong>
              </div>
              <div className="text-cdm-fg-muted mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                <span aria-label={`${p.nickname} 잔여 타일`}>
                  백 □<TileCount actual={p.remainingWhite} predicted={predicted?.white} />
                  {' · 흑 ■'}
                  <TileCount actual={p.remainingBlack} predicted={predicted?.black} />
                </span>
                {predicted && p.remainingWhite < 0 ? (
                  <span className="ml-auto">(나의 메모)</span>
                ) : gameData.phase === 'submit' && p.submitted ? (
                  <span>제출 완료</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
      <RoundHistory gameData={gameData} compact={compact} notes={notes} />
    </div>
  );
}
