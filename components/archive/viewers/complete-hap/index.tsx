'use client';

import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';
import type { GameRecordFile } from '@/shared/types/archive';
import type { CompleteHapArchiveRecord, CompleteHapCard } from '@/shared/types/complete-hap';

const BG = { black: '#111318', gray: '#7a808a', white: '#f7f7f3' } as const;
const FG = { red: '#ef4444', yellow: '#facc15', blue: '#2563eb' } as const;

export default function CompleteHapViewer({
  record,
  className,
}: {
  record: GameRecordFile;
  className?: string;
}) {
  const data = record.gameRecord as CompleteHapArchiveRecord | null;
  if (!data || !Array.isArray(data.rounds) || !Array.isArray(data.roundResults)) {
    return <p className="text-cdm-fg-muted text-sm">컴플릿 결! 합! 기록을 읽을 수 없습니다.</p>;
  }
  const players = Object.entries(data.players);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">COMPLETE HAP!</p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <div className="flex gap-4">
            {players.map(([playerId, player]) => (
              <div key={playerId} className="text-right">
                <p className="text-cdm-fg-muted text-xs font-semibold">{player.nickname}</p>
                <p className="text-cdm-primary text-2xl font-black tabular-nums">
                  {data.finalScores[playerId] ?? 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.rounds.map((round) => {
          const caller = round.result
            ? (data.players[round.result.callerId]?.nickname ?? '플레이어')
            : null;
          const pointPlayer = round.result?.pointPlayerId
            ? (data.players[round.result.pointPlayerId]?.nickname ?? '플레이어')
            : null;
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">
                    ROUND {round.round} / {data.totalRounds}
                  </p>
                  <p className="text-cdm-fg mt-0.5 text-sm font-black">
                    {round.result
                      ? round.result.correct
                        ? `${caller} 정답`
                        : `${caller} 오답`
                      : '미진행'}
                  </p>
                </div>
                {round.result && (
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-xs font-black',
                        round.result.correct ? 'text-cdm-success' : 'text-cdm-accent',
                      )}
                    >
                      {pointPlayer ? `${pointPlayer} +1` : '득점 없음'}
                    </p>
                    <p className="text-cdm-fg-muted text-[10px] tabular-nums">
                      {(round.result.elapsedMs / 1000).toFixed(1)}초
                    </p>
                  </div>
                )}
              </div>

              <div className="mx-auto grid max-w-md grid-cols-3 gap-1.5 sm:gap-2">
                {round.cards.map((card, cardIndex) => (
                  <ArchiveCard key={cardIndex} card={card} />
                ))}
              </div>

              <details className="border-cdm-border mt-3 border-t pt-3">
                <summary className="text-cdm-fg-muted cursor-pointer text-xs font-bold">
                  정답 합 {round.allSets.length}개 확인
                </summary>
                <SetList cards={round.cards} sets={round.allSets} className="mt-2" />
              </details>

              {round.result && (
                <details className="border-cdm-border mt-3 border-t pt-3">
                  <summary className="text-cdm-fg-muted cursor-pointer text-xs font-bold">
                    제출한 합 {round.result.submittedSets.length}개 확인
                  </summary>
                  <SetList cards={round.cards} sets={round.result.submittedSets} className="mt-2" />
                </details>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SetList({
  cards,
  sets,
  className,
}: {
  cards: CompleteHapCard[];
  sets: number[][];
  className?: string;
}) {
  if (sets.length === 0) {
    return <p className={cn('text-cdm-fg-muted text-xs', className)}>저장된 합이 없습니다.</p>;
  }
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {sets.map((set, setIndex) => (
        <div
          key={`${set.join('-')}-${setIndex}`}
          className="bg-cdm-bg-elev-1 rounded-cdm-md grid grid-cols-3 gap-1.5 p-2"
        >
          {set.map((cardIndex, index) =>
            cards[cardIndex] ? (
              <ArchiveCard key={`${cardIndex}-${index}`} card={cards[cardIndex]} compact />
            ) : (
              <span
                key={`${cardIndex}-${index}`}
                className="border-cdm-accent bg-cdm-accent-soft rounded-cdm-sm aspect-square border"
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function ArchiveCard({ card, compact = false }: { card: CompleteHapCard; compact?: boolean }) {
  const shapeStyle = { backgroundColor: FG[card.color] };
  return (
    <div
      className={cn(
        'rounded-cdm-md border-cdm-border-strong relative flex aspect-square items-center justify-center border',
        compact && 'rounded-cdm-sm',
      )}
      style={{ backgroundColor: BG[card.background] }}
    >
      <span
        className={cn(
          'block h-[46%] w-[46%]',
          card.shape === 'circle' && 'rounded-full',
          card.shape === 'triangle' &&
            'h-0 w-0 border-x-[1.4rem] border-b-[2.5rem] border-x-transparent bg-transparent',
          compact && card.shape === 'triangle' && 'border-x-[0.75rem] border-b-[1.35rem]',
        )}
        style={card.shape === 'triangle' ? { borderBottomColor: FG[card.color] } : shapeStyle}
      />
    </div>
  );
}
