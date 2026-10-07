'use client';
import type { BNW2GameData } from '@/shared/types/bnw2';

export function RoundHistoryTable({
  history,
  players,
  myId,
}: {
  history: BNW2GameData['roundHistory'];
  players: BNW2GameData['players'];
  myId: string;
}) {
  if (history.length === 0) return null;
  return (
    <div className="space-y-1 text-xs">
      {history.map((r) => {
        const entries = Object.entries(r.players);
        return (
          <div key={r.round} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">
            <span className="text-cdm-ink-fg-muted w-6 shrink-0 font-medium">R{r.round}</span>
            {entries.map(([pid, pd]) => {
              const isWinner = r.winnerId === pid;

              return (
                <span key={pid} className="flex min-w-0 items-center gap-1">
                  <span
                    className={`shrink-0 rounded px-1 text-[11px] font-bold ${
                      pd.color === 'black'
                        ? 'bg-slate-800 text-slate-100'
                        : 'border border-gray-200 bg-white text-slate-700'
                    }`}
                  >
                    {pd.color === 'black' ? '흑' : '백'}
                  </span>
                  <span className="text-cdm-ink-fg-muted">
                    {pid === myId ? '나' : (players[pid]?.nickname ?? '')}
                  </span>
                  {/*
                    내가 낸 포인트만 적는다. 이 게임은 공개 시점에도 색과 꺼진 불 칸수만
                    알려 주지 정확한 숫자는 밝히지 않는다 — 상대 것까지 적으면 추리의
                    핵심을 그대로 넘겨주는 셈이다.
                  */}
                  {pid === myId && (
                    <span className="text-cdm-ink-fg font-bold tabular-nums">{pd.points}p</span>
                  )}
                  {isWinner && <span className="text-amber-500">+1</span>}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
