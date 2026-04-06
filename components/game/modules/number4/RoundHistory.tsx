'use client';

import type { NF4RoundRecord, NF4PlayerInfo } from '@/shared/types/number4';

interface RoundHistoryProps {
  roundHistory: NF4RoundRecord[];
  players: Record<string, NF4PlayerInfo>;
}

export default function RoundHistory({ roundHistory, players }: RoundHistoryProps) {
  if (roundHistory.length === 0) {
    return <div className="text-xs text-gray-400">아직 기록이 없습니다</div>;
  }

  const playerIds = Object.keys(players);

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-500">라운드 기록</div>
      {roundHistory.map((r) => (
        <div key={r.round} className="rounded-md border border-gray-100 bg-gray-50 p-2">
          <div className="mb-1 text-xs font-medium text-gray-500">R{r.round}</div>
          <div className="space-y-0.5">
            {playerIds.map((pid) => {
              const pr = r.players[pid];
              if (!pr) return null;
              const p = players[pid];
              return (
                <div key={pid} className="flex items-center gap-1.5 text-[11px]">
                  <span className="truncate max-w-[60px] text-gray-600">{p?.nickname}</span>
                  <span className="font-medium">N{pr.number}</span>
                  <span>{pr.success ? '✅' : '❌'}</span>
                  <span className={pr.scoreChange > 0 ? 'text-green-600' : 'text-red-500'}>
                    {pr.scoreChange > 0 ? `+${pr.scoreChange}` : pr.scoreChange}
                  </span>
                  <span className="text-gray-400">({pr.scoreAfter}점)</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
