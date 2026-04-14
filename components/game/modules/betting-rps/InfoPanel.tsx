'use client';

import type { BRPSPlayerInfo, BRPSRoundRecord } from '@/shared/types/betting-rps';
import { BRPS_INITIAL_CHIPS, BRPS_TOTAL_ROUNDS } from '@/shared/types/betting-rps';
import RoundHistoryTable from './RoundHistoryTable';

interface Props {
  round: number;
  totalRounds: number;
  players: Record<string, BRPSPlayerInfo>;
  roundHistory: BRPSRoundRecord[];
  myId: string;
}

export default function InfoPanel({ round, totalRounds, players, roundHistory, myId }: Props) {
  const pIds = Object.keys(players);
  const maxChips = BRPS_INITIAL_CHIPS + BRPS_TOTAL_ROUNDS * 2; // theoretical max

  return (
    <div className="space-y-0 divide-y divide-gray-100 text-sm">
      {/* Header */}
      <div className="pb-3 font-semibold text-gray-700">
        라운드 {round} / {totalRounds}
      </div>

      {/* Chips */}
      <div className="py-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">칩</div>
        {pIds.map((pid) => {
          const p = players[pid];
          const isMe = pid === myId;
          const pct = Math.min(100, (p.chips / Math.max(1, maxChips)) * 100);
          const barColor = p.chips >= 4 ? 'bg-blue-500' : p.chips >= 2 ? 'bg-amber-400' : 'bg-red-500';
          return (
            <div key={pid} className="flex items-center gap-2">
              <span
                className={`w-14 shrink-0 truncate text-xs ${
                  isMe ? 'font-bold text-gray-800' : 'text-gray-500'
                }`}
              >
                {isMe ? '나' : p.nickname}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-gray-700">
                {p.chips}
              </span>
            </div>
          );
        })}
      </div>

      {/* Round history */}
      {roundHistory.length > 0 && (
        <div className="py-3 space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            라운드 기록
          </div>
          <RoundHistoryTable history={roundHistory} players={players} myId={myId} />
        </div>
      )}
    </div>
  );
}
