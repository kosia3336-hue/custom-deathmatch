'use client';

import type { BRPSPlayerInfo, BRPSRoundRecord } from '@/shared/types/betting-rps';
import { RESULT_LABELS, RESULT_COLORS, OUTCOME_LABELS, OUTCOME_COLORS } from './constants';

interface Props {
  history: BRPSRoundRecord[];
  players: Record<string, BRPSPlayerInfo>;
  myId?: string;
  compact?: boolean;
}

export default function RoundHistoryTable({ history, players, myId, compact }: Props) {
  if (history.length === 0) return null;

  const textSz = compact ? 'text-[10px]' : 'text-[11px]';
  const headerSz = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="w-full overflow-hidden">
      {/* Header */}
      <div className={`grid grid-cols-[18px_28px_1fr_auto] items-center gap-x-1.5 pb-0.5 ${headerSz} font-medium text-gray-400`}>
        <span>#</span>
        <span>역할</span>
        <span>선택 / 예측</span>
        <span className="text-right">칩</span>
      </div>

      <div className="border-t border-gray-100 pt-1 space-y-1.5">
        {history.map((r) => {
          const pEntries = Object.entries(r.players);
          const matchEntry = pEntries.find(([, p]) => p.role === 'match');
          const betEntry = pEntries.find(([, p]) => p.role === 'bet');

          const matchPlayerId = matchEntry?.[0];
          const betPlayerId = betEntry?.[0];

          const matchResult = matchEntry?.[1].matchResult;
          const matchChipChange = matchEntry?.[1].chipChange ?? 0;

          const prediction = betEntry?.[1].prediction;
          const outcome = betEntry?.[1].betOutcome;
          const betChipChange = betEntry?.[1].chipChange ?? 0;

          const isMatchMe = matchPlayerId === myId;
          const isBetMe = betPlayerId === myId;

          const matchNick = matchPlayerId
            ? (myId ? (isMatchMe ? '나' : (players[matchPlayerId]?.nickname ?? '?')) : (players[matchPlayerId]?.nickname ?? '?'))
            : '—';
          const betNick = betPlayerId
            ? (myId ? (isBetMe ? '나' : (players[betPlayerId]?.nickname ?? '?')) : (players[betPlayerId]?.nickname ?? '?'))
            : '—';

          return (
            <div key={r.round} className={`${textSz} space-y-0.5`}>
              {/* Match player row */}
              <div className="grid grid-cols-[18px_28px_1fr_auto] items-baseline gap-x-1.5">
                <span className="font-bold text-gray-400">{r.round}</span>
                <span className="text-gray-400">승부</span>
                <span className={`truncate font-medium ${isMatchMe ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {matchNick}&nbsp;
                  <span className={`font-bold ${matchResult ? RESULT_COLORS[matchResult] : 'text-gray-300'}`}>
                    {matchResult ? RESULT_LABELS[matchResult] : '—'}
                  </span>
                </span>
                <span className={`text-right tabular-nums font-semibold ${
                  matchChipChange > 0 ? 'text-emerald-600' : 'text-gray-300'
                }`}>
                  {matchChipChange > 0 ? `+${matchChipChange}` : '—'}
                </span>
              </div>

              {/* Bet player row */}
              <div className="grid grid-cols-[18px_28px_1fr_auto] items-baseline gap-x-1.5">
                <span />
                <span className="text-gray-400">베팅</span>
                <span className={`truncate font-medium ${isBetMe ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {betNick}&nbsp;
                  <span className={`font-bold ${prediction ? RESULT_COLORS[prediction] : 'text-gray-300'}`}>
                    {prediction ? RESULT_LABELS[prediction] : '—'}
                  </span>
                  {outcome && (
                    <span className={`ml-1 font-semibold ${OUTCOME_COLORS[outcome]}`}>
                      {OUTCOME_LABELS[outcome]}
                    </span>
                  )}
                </span>
                <span className={`text-right tabular-nums font-semibold ${
                  betChipChange > 0 ? 'text-emerald-600' : betChipChange < 0 ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {betChipChange > 0 ? '+' : ''}{betChipChange !== 0 ? betChipChange : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
