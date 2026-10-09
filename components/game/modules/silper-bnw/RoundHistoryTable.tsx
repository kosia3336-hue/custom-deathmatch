'use client';
import type { SBNWPlayerInfo, SBNWRoundRecord } from '@/shared/types/silper-bnw';

export function RoundHistoryTable({
  history,
  players,
  myId,
}: {
  history: SBNWRoundRecord[];
  players: Record<string, SBNWPlayerInfo>;
  myId: string;
}) {
  if (history.length === 0) return null;
  return (
    <div className="space-y-0.5 text-xs">
      {/* 다른 게임 기록과 같이 최신 라운드가 맨 위 */}
      {[...history].reverse().map((r) => {
        const fEntry = Object.entries(r.players).find(([id]) => id === r.firstPlayerId);
        const sEntry = Object.entries(r.players).find(([id]) => id !== r.firstPlayerId);
        if (!fEntry || !sEntry) return null;
        const [fid, fd] = fEntry;
        const [sid, sd] = sEntry;
        return (
          <div key={r.round} className="flex flex-wrap items-center gap-1 py-0.5 tabular-nums">
            <span className="w-6 shrink-0 font-medium text-gray-400">R{r.round}</span>
            {/* 선플 */}
            <span className="min-w-0 truncate text-gray-600">
              <span className={fid === myId ? 'font-bold text-indigo-700' : ''}>
                {fid === myId ? '나' : (players[fid]?.nickname ?? '')}
              </span>
              <span className="mx-0.5 text-xs text-amber-500">(선)</span>
              <span className="text-gray-500">{fd.digits}자리</span>
              {fid === myId && fd.valueStr && (
                <span className="text-gray-400"> ={fd.valueStr}</span>
              )}
            </span>
            <span className="text-gray-300">vs</span>
            {/* 후플 */}
            <span className="min-w-0 truncate text-gray-600">
              <span className={sid === myId ? 'font-bold text-indigo-700' : ''}>
                {sid === myId ? '나' : (players[sid]?.nickname ?? '')}
              </span>{' '}
              <span className="text-gray-500">{sd.digits}자리</span>
              {sid === myId && sd.valueStr && (
                <span className="text-gray-400"> ={sd.valueStr}</span>
              )}
            </span>
            {r.winnerId === null ? (
              <span className="text-gray-400">동률</span>
            ) : (
              <span className="text-emerald-600">
                {r.winnerId === myId ? '나' : (players[r.winnerId]?.nickname ?? '')} +1
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
