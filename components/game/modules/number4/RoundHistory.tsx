'use client';

import type { NF4RoundRecord, NF4PlayerInfo } from '@/shared/types/number4';

interface RoundHistoryProps {
  roundHistory: NF4RoundRecord[];
  players: Record<string, NF4PlayerInfo>;
}

/** InfoPanel 안(짙은 판 정보 칸)에서만 쓰인다 — 글자색은 ink 토큰. */
export default function RoundHistory({ roundHistory, players }: RoundHistoryProps) {
  if (roundHistory.length === 0) {
    return <div className="text-xs text-cdm-ink-fg-muted">아직 기록이 없습니다</div>;
  }

  const playerIds = Object.keys(players);

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-cdm-ink-fg-muted">라운드 기록</div>
      {roundHistory.map((r) => (
        <div key={r.round} className="rounded-md border border-cdm-ink-border bg-white/5 p-2">
          <div className="mb-1 text-xs font-medium text-cdm-ink-fg-muted">R{r.round}</div>
          <div className="space-y-0.5">
            {playerIds.map((pid) => {
              const pr = r.players[pid];
              if (!pr) return null;
              const p = players[pid];
              return (
                <div key={pid} className="flex items-center gap-1.5 text-[11px] text-cdm-ink-fg">
                  <span className="truncate max-w-[60px]">{p?.nickname}</span>
                  <span className="font-medium">N{pr.number}</span>
                  <span className={pr.scoreChange > 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {pr.scoreChange > 0 ? `+${pr.scoreChange}` : pr.scoreChange}
                  </span>
                  <span className="text-cdm-ink-fg-muted">({pr.scoreAfter}점)</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
