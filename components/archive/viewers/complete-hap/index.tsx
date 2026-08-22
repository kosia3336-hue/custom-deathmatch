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
  if (!data || !Array.isArray(data.boards) || !Array.isArray(data.claims)) {
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
                  {data.finalCorrectCounts[playerId] ?? 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {data.boards.map((board, boardIndex) => (
          <Card key={boardIndex} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-cdm-fg text-sm font-black">{boardIndex + 1}번 문제</p>
              <p className="text-cdm-fg-muted text-[11px]">
                선점 {board.claims.length}/{board.allSets.length}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {board.cards.map((card, cardIndex) => (
                <ArchiveCard key={cardIndex} card={card} number={cardIndex + 1} />
              ))}
            </div>
            <p className="text-cdm-fg-muted mt-2 text-[11px] leading-relaxed">
              정답:{' '}
              {board.allSets.map((set) => set.map((index) => index + 1).join('·')).join(' / ') ||
                '없음'}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-3 sm:p-4">
        <p className="text-cdm-fg mb-3 text-sm font-black">정답 선점 기록</p>
        {data.claims.length === 0 ? (
          <p className="text-cdm-fg-muted text-xs">선점된 정답이 없습니다.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.claims.map((claim, index) => (
              <div
                key={`${claim.boardIndex}-${claim.cardIndexes.join('-')}-${index}`}
                className="rounded-cdm-md bg-cdm-bg-elev-1 px-3 py-2"
              >
                <p className="text-cdm-fg-subtle text-[10px] font-bold">
                  {(claim.elapsedMs / 1000).toFixed(1)}초 ·{' '}
                  {data.players[claim.playerId]?.nickname ?? claim.playerId}
                </p>
                <p className="text-cdm-fg mt-0.5 text-xs font-semibold">
                  {claim.boardIndex + 1}번 · 합{' '}
                  {claim.cardIndexes.map((cardIndex) => cardIndex + 1).join('·')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ArchiveCard({ card, number }: { card: CompleteHapCard; number: number }) {
  const shapeStyle = {
    backgroundColor: FG[card.color],
    borderColor: 'rgba(0,0,0,.25)',
  };
  return (
    <div
      className="rounded-cdm-md border-cdm-border-strong relative flex aspect-[4/3] items-center justify-center border"
      style={{ backgroundColor: BG[card.background] }}
    >
      <span
        className="absolute top-1 left-1 text-[9px] font-black"
        style={{ color: card.background === 'white' ? '#111318' : '#fff' }}
      >
        {number}
      </span>
      <span
        className={cn(
          'block h-8 w-8 border',
          card.shape === 'circle' && 'rounded-full',
          card.shape === 'triangle' &&
            'h-0 w-0 border-x-[18px] border-b-[32px] border-x-transparent bg-transparent',
        )}
        style={card.shape === 'triangle' ? { borderBottomColor: FG[card.color] } : shapeStyle}
      />
    </div>
  );
}
