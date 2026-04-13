'use client';

import type { IDPlayerInfo, IDRoundRecord, IDCoinStock } from '@/shared/types/invest-donate';
import { ID_INITIAL_SCORE, ID_TOTAL_ROUNDS } from '@/shared/types/invest-donate';
import RoundHistoryTable from './RoundHistoryTable';

interface Props {
  round: number;
  totalRounds: number;
  players: Record<string, IDPlayerInfo>;
  roundHistory: IDRoundRecord[];
  myId: string;
}

function CoinDisplay({ stock }: { stock: IDCoinStock }) {
  const total = stock.coin50 * 50 + stock.coin10 * 10 + stock.coin1;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="tabular-nums text-gray-600">
        50×{stock.coin50}
      </span>
      <span className="tabular-nums text-gray-600">
        10×{stock.coin10}
      </span>
      <span className="tabular-nums text-gray-600">
        1×{stock.coin1}
      </span>
      <span className="ml-auto tabular-nums font-semibold text-gray-700">{total}원</span>
    </div>
  );
}

export default function InfoPanel({ round, totalRounds, players, roundHistory, myId }: Props) {
  const pIds = Object.keys(players);

  return (
    <div className="space-y-0 text-sm divide-y divide-gray-100">
      {/* Header */}
      <div className="pb-3 font-semibold text-gray-700">
        라운드 {round} / {totalRounds}
      </div>

      {/* Score */}
      <div className="py-3 space-y-1.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">승점</div>
        {pIds.map((pid) => {
          const p = players[pid];
          const isMe = pid === myId;
          const maxScore = ID_INITIAL_SCORE + ID_TOTAL_ROUNDS;
          const pct = Math.min(100, (p.score / maxScore) * 100);
          const barColor =
            p.score >= 4 ? 'bg-blue-500' : p.score >= 2 ? 'bg-amber-400' : 'bg-red-500';
          return (
            <div key={pid} className="flex items-center gap-2">
              <span
                className={`w-14 shrink-0 truncate text-xs ${
                  isMe ? 'font-bold text-gray-800' : 'text-gray-500'
                }`}
              >
                {isMe ? '나' : p.nickname}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={`w-4 shrink-0 text-right text-xs font-bold tabular-nums ${
                  p.score <= 1 ? 'animate-pulse text-red-500' : 'text-gray-700'
                }`}
              >
                {p.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* My coins */}
      {players[myId] && (
        <div className="py-3 space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            보유 코인
          </div>
          <CoinDisplay stock={players[myId].coinStock} />
        </div>
      )}

      {/* Round history */}
      {roundHistory.length > 0 && (
        <div className="py-3 space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            라운드 기록
          </div>
          <RoundHistoryTable history={roundHistory} players={players} />
        </div>
      )}
    </div>
  );
}
