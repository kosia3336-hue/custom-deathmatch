'use client';
import type { WinningStreakGameData, WSPlayerInfo } from '@/shared/types/winning-streak';
import { CARD_COLORS } from './constants';

export function RoundHistory({
  history,
  players,
}: {
  history: WinningStreakGameData['roundHistory'];
  players: Record<string, WSPlayerInfo>;
}) {
  const playerIds = Object.keys(players);

  return (
    <div className="border-cdm-ink-border h-full w-full rounded-xl border bg-white/5">
      <div className="max-h-72 space-y-1.5 overflow-y-auto p-2 lg:max-h-[420px]">
        {history.length === 0 ? (
          <p className="text-cdm-ink-fg-muted py-4 text-center text-sm">아직 기록이 없습니다</p>
        ) : (
          [...history].reverse().map((round) => (
            <div
              key={round.round}
              className="border-cdm-ink-border rounded-lg border bg-white/5 p-2"
            >
              <div className="text-cdm-ink-fg-muted mb-1 text-xs font-semibold lg:text-sm">
                R{round.round}
              </div>
              <div className="flex flex-col gap-1">
                {playerIds.map((pid) => {
                  const pr = round.players[pid];
                  if (!pr) return null;
                  const style = CARD_COLORS[pr.card];
                  const isWin = pr.result === 'win' || pr.result === 'draw_win';
                  return (
                    <div key={pid} className="flex items-center gap-1.5 text-xs lg:text-sm">
                      <span className={`rounded px-1.5 py-0.5 ${style.bg} ${style.text}`}>
                        {style.icon}
                      </span>
                      <span className="text-cdm-ink-fg-muted max-w-[72px] truncate">
                        {players[pid]?.nickname ?? pid}
                      </span>
                      <span
                        className={`ml-auto font-bold ${isWin ? 'text-emerald-600' : 'text-red-400'}`}
                      >
                        {isWin ? '승' : '패'}
                      </span>
                      {pr.streakAfter > 0 && (
                        <span className="text-orange-500">{pr.streakAfter}연</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
