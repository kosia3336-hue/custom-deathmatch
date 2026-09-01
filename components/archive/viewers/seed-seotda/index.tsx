'use client';

import { Card } from '@/components/cdm/Card';
import { SeedSeotdaCard } from '@/components/game/cards';
import type { GameRecordFile } from '@/shared/types/archive';
import type { SeedSeotdaArchiveRecord } from '@/shared/types/seed-seotda';

const ACTION_LABEL = {
  bet: '베팅',
  call: '콜',
  raise: '레이즈',
  die: '다이',
} as const;

export default function SeedSeotdaViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as SeedSeotdaArchiveRecord | null;
  if (!data || !Array.isArray(data.rounds)) {
    return <p className="text-cdm-fg-muted text-sm">시드섯다 기록을 읽을 수 없습니다.</p>;
  }
  const players = Object.entries(data.players);
  const winnerName = data.winnerId ? data.players[data.winnerId]?.nickname : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">SEED SEOTDA</p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
            <p className="text-cdm-fg-muted mt-1 text-xs">사용한 덱 {data.deckCycles}벌</p>
          </div>
          <div className="flex gap-5">
            {players.map(([playerId, player]) => (
              <div key={playerId} className="text-right">
                <p className="text-cdm-fg-muted text-xs font-semibold">{player.nickname}</p>
                <p className="text-cdm-primary text-2xl font-black tabular-nums">
                  {data.finalChips[playerId] ?? 0}칩
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-cdm-highlight mt-2 text-sm font-black">
          {winnerName ? `${winnerName} 승리` : '무승부'}
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.rounds.map((round) => {
          const winner = round.winnerId ? data.players[round.winnerId]?.nickname : null;
          const resultLabel =
            round.reason === 'tie'
              ? '동일 족보 · 재경기'
              : round.reason === 'gusa-rematch'
                ? '구사 · 재경기'
                : round.reason === 'mung-gusa-rematch'
                  ? '멍텅구리 구사 · 재경기'
                  : round.reason === 'die'
                    ? `${winner} 다이 승리`
                    : `${winner} 승리`;
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">
                    ROUND {round.round}
                  </p>
                  <p className="text-cdm-fg mt-0.5 text-sm font-black">{resultLabel}</p>
                  {round.diePenalty > 0 && (
                    <p className="text-cdm-accent mt-0.5 text-[10px] font-black">
                      다이 패널티 {round.diePenalty}칩
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-cdm-primary text-sm font-black">팟 {round.potAmount}</p>
                  <p className="text-cdm-fg-muted text-[10px]">
                    {round.carryRound ? '재경기 · 기본 베팅 없음' : '기본 베팅 1칩'}
                  </p>
                </div>
              </div>

              <div className="mt-3 text-center">
                <p className="text-cdm-fg-muted text-[10px] font-bold">시드패</p>
                <SeedSeotdaCard card={round.seedCard} size="sm" className="mt-1" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {players.map(([playerId, player]) => {
                  const hand = round.hands[playerId];
                  const evaluation = round.evaluations[playerId];
                  return (
                    <div key={playerId} className="bg-cdm-bg-elev-1 rounded-cdm-md p-2 text-center">
                      <p className="text-cdm-fg-muted truncate text-[10px]">{player.nickname}</p>
                      <p className="text-cdm-fg-subtle mt-0.5 text-[9px] font-bold">
                        {round.seedChoices[playerId] === 'used' ? '시드 사용' : '시드 미사용'}
                      </p>
                      <div className="mt-1 flex justify-center gap-1">
                        {(hand ?? [null, null]).map((card, index) => (
                          <SeedSeotdaCard
                            key={`${card?.id ?? 'hidden'}-${index}`}
                            card={card}
                            size="sm"
                          />
                        ))}
                      </div>
                      <p className="text-cdm-fg mt-1 min-h-4 text-xs font-black">
                        {evaluation?.name ?? '비공개'}
                      </p>
                    </div>
                  );
                })}
              </div>

              <details className="border-cdm-border mt-3 border-t pt-3">
                <summary className="text-cdm-fg-muted cursor-pointer text-xs font-bold">
                  베팅 기록 {round.actions.length}개
                </summary>
                <div className="mt-2 space-y-1">
                  {round.actions.map((action, index) => (
                    <p key={index} className="bg-cdm-bg-elev-1 rounded-cdm-sm px-2 py-1 text-xs">
                      <b>{data.players[action.playerId]?.nickname}</b> ·{' '}
                      {ACTION_LABEL[action.action]}
                      {action.amount > 0 ? ` +${action.amount}` : ''}
                    </p>
                  ))}
                </div>
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
