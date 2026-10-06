'use client';

import type { IDPlayerInfo, IDRoundRecord } from '@/shared/types/invest-donate';

export default function RoundHistoryTable({
  history,
  players,
  myId,
}: {
  history: IDRoundRecord[];
  players: Record<string, IDPlayerInfo>;
  myId: string;
}) {
  if (!history.length)
    return <p className="py-2 text-center text-xs text-gray-400">아직 완료된 라운드가 없습니다.</p>;
  const ids = Object.keys(players).sort((a, b) => Number(b === myId) - Number(a === myId));
  return (
    <div className="space-y-2">
      {[...history]
        .sort((a, b) => b.round - a.round)
        .map((record) => (
          <article
            key={record.round}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
          >
            <h3 className="mb-1 text-[11px] font-semibold text-gray-500">R{record.round}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {ids.map((id) => {
                const result = record.players[id];
                if (!result) return null;
                return (
                  <div key={id} className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-gray-700">
                        {players[id].nickname}
                        {id === myId && ' (나)'}
                      </span>
                      <span
                        className={
                          result.scoreChange > 0
                            ? 'text-emerald-700'
                            : result.scoreChange < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                        }
                      >
                        {result.scoreChange > 0 ? '+' : ''}
                        {result.scoreChange} ({result.scoreAfter}점)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-gray-500">
                      <span>
                        투자 <b className="font-semibold text-blue-600">{result.investTotal}원</b>
                      </span>
                      <span>
                        기부{' '}
                        <b className="font-semibold text-emerald-600">{result.donateTotal}원</b>
                      </span>
                      {result.investBadge && <span className="text-amber-700">○ 대주주</span>}
                      {result.donateBadge && <span className="text-red-600">● 수전노</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
    </div>
  );
}
