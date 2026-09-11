'use client';

import { Card } from '@/components/cdm/Card';
import { PlayingCard } from '@/components/game/cards';
import type { GameRecordFile } from '@/shared/types/archive';
import type { DoubleSidedPokerArchiveRecord } from '@/shared/types/double-sided-poker';

const ACTION_LABEL = {
  bet: '베팅',
  call: '콜',
  raise: '레이즈',
  double: '양면베팅',
  select: '면 선택',
  fold: '다이',
} as const;

export default function DoubleSidedPokerViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as DoubleSidedPokerArchiveRecord | null;
  if (!data || !Array.isArray(data.rounds)) {
    return <p className="text-cdm-fg-muted text-sm">양면포커 기록을 읽을 수 없습니다.</p>;
  }
  const playerEntries = Object.entries(data.players);
  const winnerName = data.winnerId ? data.players[data.winnerId]?.nickname : null;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">
              DOUBLE-SIDED POKER
            </p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
            <p className="text-cdm-highlight mt-1 text-sm font-black">
              {winnerName ? `${winnerName} 승리` : '무승부'}
            </p>
          </div>
          <div className="flex gap-5">
            {playerEntries.map(([playerId, player]) => (
              <div key={playerId} className="text-right">
                <p className="text-cdm-fg-muted text-xs font-semibold">{player.nickname}</p>
                <p className="text-cdm-primary text-2xl font-black tabular-nums">
                  {data.finalChips[playerId] ?? 0}칩
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.rounds.map((round) => {
          const winner = round.winnerId ? data.players[round.winnerId]?.nickname : null;
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">
                    ROUND {round.round}
                  </p>
                  <p className="text-cdm-fg mt-0.5 text-sm font-black">
                    {round.reason === 'tie'
                      ? '동점 · 팟 이월'
                      : round.reason === 'fold'
                        ? `${winner} 다이 승리`
                        : `${winner} 승리`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-cdm-primary text-sm font-black">팟 {round.potAmount}</p>
                  {round.doubleBonus > 0 && (
                    <p className="text-cdm-accent text-[10px] font-black">
                      양면 보너스 +{round.doubleBonus}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {playerEntries.map(([playerId, player]) => {
                  const card = round.cards[playerId];
                  const selection = round.selections[playerId];
                  const bet = round.bets[playerId];
                  return (
                    <div key={playerId} className="bg-cdm-bg-elev-1 rounded-cdm-md p-2 text-center">
                      <p className="text-cdm-fg-muted truncate text-[10px]">{player.nickname}</p>
                      <div className="mt-1 flex justify-center gap-1">
                        {card && <PlayingCard value={card.front} face="front" size="sm" />}
                        {card?.back != null && (
                          <PlayingCard value={card.back} face="back" size="sm" />
                        )}
                      </div>
                      {card && card.back == null && (
                        <p className="text-cdm-fg-subtle mt-1 text-[9px]">뒷면 비공개</p>
                      )}
                      <p className="text-cdm-fg mt-1 text-[10px] font-black">
                        {selection === 'both'
                          ? '양면베팅'
                          : selection === 'front'
                            ? '앞면 선택'
                            : selection === 'back'
                              ? '뒷면 선택'
                              : '면 미선택'}
                      </p>
                      <p className="text-cdm-fg-muted text-[10px]">
                        앞 {bet?.front ?? 0} · 뒤 {bet?.back ?? 0}
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
                      {ACTION_LABEL[action.action]} · 지불 {action.payment} · 기준 {action.stake}
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
