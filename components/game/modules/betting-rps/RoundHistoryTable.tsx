import type { BRPSPlayerInfo, BRPSRoundRecord } from '@/shared/types/betting-rps';
import { RESULT_LABELS, RESULT_COLORS, OUTCOME_LABELS, OUTCOME_COLORS } from './constants';
export default function RoundHistoryTable({
  history,
  players,
  myId,
}: {
  history: BRPSRoundRecord[];
  players: Record<string, BRPSPlayerInfo>;
  myId?: string;
}) {
  if (!history.length) return <p className="text-xs text-gray-400">완료된 라운드가 없습니다.</p>;
  return (
    <div className="space-y-2">
      {[...history]
        .sort((a, b) => b.round - a.round)
        .map((record) => (
          <article
            key={record.round}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px]"
          >
            <div className="mb-1 font-bold text-gray-600">R{record.round}</div>
            {Object.entries(record.players).map(([id, p]) => {
              const result = p.role === 'match' ? p.matchResult : p.prediction;
              return (
                <div
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-1 py-0.5 text-gray-600"
                >
                  <div>
                    <strong>
                      {players[id]?.nickname ?? '플레이어'}
                      {id === myId ? ' (나)' : ''}
                    </strong>
                    <span className="mx-1.5">{p.role === 'match' ? '승부' : '베팅'}</span>
                    {result && (
                      <strong className={RESULT_COLORS[result]}>{RESULT_LABELS[result]}</strong>
                    )}
                    {p.role === 'bet' && (
                      <span className="ml-1">
                        {p.betChips}칩 ·{' '}
                        <span className={p.betOutcome ? OUTCOME_COLORS[p.betOutcome] : ''}>
                          {p.betOutcome ? OUTCOME_LABELS[p.betOutcome] : ''}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums">
                    {p.chipChange > 0 ? '+' : ''}
                    {p.chipChange}칩 ({p.chipsAfter}칩)
                  </span>
                </div>
              );
            })}
          </article>
        ))}
    </div>
  );
}
