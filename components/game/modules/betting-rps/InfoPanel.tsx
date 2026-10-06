'use client';

import { GameInfoPart } from '@/components/game/GameInfoPart';

import type { BRPSPlayerInfo, BRPSRoundRecord } from '@/shared/types/betting-rps';
import {
  BRPS_INITIAL_CHIPS,
  BRPS_TOTAL_ROUNDS,
  brpsMatchWinBonus,
} from '@/shared/types/betting-rps';
import RoundHistoryTable from './RoundHistoryTable';

interface Props {
  players: Record<string, BRPSPlayerInfo>;
  roundHistory: BRPSRoundRecord[];
  myId: string;
  round: number;
}

export default function InfoPanel({ players, roundHistory, myId, round }: Props) {
  const pIds = Object.keys(players);
  const maxChips = BRPS_INITIAL_CHIPS + BRPS_TOTAL_ROUNDS * 2; // theoretical max

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Chips */}
      <GameInfoPart title="칩" sizeToContent>
        <p className="text-cdm-ink-fg-muted mb-2 text-xs">
          이번 승리 +{brpsMatchWinBonus(round)}칩
        </p>
        {pIds.map((pid) => {
          const p = players[pid];
          const isMe = pid === myId;
          const pct = Math.min(100, (p.chips / Math.max(1, maxChips)) * 100);
          const barColor =
            p.chips >= 4 ? 'bg-blue-500' : p.chips >= 2 ? 'bg-amber-400' : 'bg-red-500';
          return (
            <div key={pid} className="flex items-center gap-2">
              <span
                className={`w-14 shrink-0 truncate text-xs ${
                  isMe ? 'text-cdm-ink-fg font-bold' : 'text-cdm-ink-fg-muted'
                }`}
              >
                {isMe ? '나' : p.nickname}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-cdm-ink-fg w-6 shrink-0 text-right text-xs font-bold tabular-nums">
                {p.chips}
              </span>
            </div>
          );
        })}
      </GameInfoPart>

      {/* Round history */}
      {roundHistory.length > 0 && (
        <GameInfoPart title="라운드 기록">
          <RoundHistoryTable history={roundHistory} players={players} myId={myId} />
        </GameInfoPart>
      )}
    </div>
  );
}
