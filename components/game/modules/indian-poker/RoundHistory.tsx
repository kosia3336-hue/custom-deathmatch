'use client';

import type { IPRoundRecord, IPPlayerInfo } from '@/shared/types/indian-poker';
import { HAND_LABELS, HAND_COLORS } from './constants';

interface RoundHistoryProps {
  roundHistory: IPRoundRecord[];
  players: Record<string, IPPlayerInfo>;
}

export default function RoundHistory({ roundHistory, players }: RoundHistoryProps) {
  if (roundHistory.length === 0) {
    return <div className="text-xs text-gray-400">아직 기록이 없습니다</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-500">라운드 기록</div>
      {[...roundHistory].reverse().map((r) => (
        <div key={r.round} className="rounded-md border border-gray-100 bg-gray-50 p-2">
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">R{r.round}</span>
            <span>공유: [{r.communityCards.join(', ')}]</span>
            {r.isDie && <span className="text-red-400">다이</span>}
            {r.isDraw && <span className="text-gray-400">무승부</span>}
          </div>
          {r.hands && (
            <div className="space-y-0.5">
              {Object.entries(r.hands).map(([pid, data]) => {
                const p = players[pid];
                const chipChange = r.chipChanges[pid];
                return (
                  <div key={pid} className="flex items-center gap-1.5 text-[11px]">
                    <span className="truncate max-w-[60px] text-gray-600">{p?.nickname}</span>
                    <span className="font-medium">{data.card}</span>
                    <span style={{ color: HAND_COLORS[data.hand] }}>{HAND_LABELS[data.hand]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
