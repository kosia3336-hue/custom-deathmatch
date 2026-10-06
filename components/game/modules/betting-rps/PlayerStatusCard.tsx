'use client';

import { brpsMatchWinBonus } from '@/shared/types/betting-rps';
import type { BRPSPlayerInfo } from '@/shared/types/betting-rps';

interface Props {
  players: Record<string, BRPSPlayerInfo>;
  myId: string;
  round: number;
  isSpectator?: boolean;
}

export default function PlayerStatusCard({ players, myId, round, isSpectator }: Props) {
  const pIds = Object.keys(players).sort((a, b) =>
    !isSpectator ? Number(b === myId) - Number(a === myId) : 0,
  );

  return (
    <div data-brps-status className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2">
      {pIds.map((pid, idx) => {
        const p = players[pid];
        const isMe = !isSpectator && pid === myId;

        let roleLabel = '';
        if (p.role === 'match') roleLabel = `승부 · 승 선택시 +${brpsMatchWinBonus(round)}칩`;
        else if (p.role === 'bet') roleLabel = '베팅';

        return (
          <div key={pid}>
            {idx > 0 && <div className="my-1.5 border-t border-gray-100" />}

            <div className="flex items-center justify-between gap-3">
              {/* Nickname */}
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  className={`min-w-0 truncate text-sm ${
                    isMe ? 'font-bold text-indigo-700' : 'font-medium text-gray-700'
                  }`}
                >
                  {p.nickname}
                  {isMe && <span className="ml-1 text-xs font-normal text-indigo-400">(나)</span>}
                </span>
                {!isSpectator && p.hasChoiceRight && (
                  <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-700">
                    선택권
                  </span>
                )}
                {roleLabel && (
                  <span
                    data-brps-role={p.role ?? undefined}
                    className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[11px] font-medium text-gray-600"
                  >
                    {roleLabel}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {/* Chips */}
                <span className="text-sm font-bold text-gray-700 tabular-nums">{p.chips}칩</span>

                {/* Submission dot — players only */}
                {!isSpectator && !isMe && (
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                      p.submitted ? 'bg-emerald-500' : 'animate-pulse bg-gray-300'
                    }`}
                    title={p.submitted ? '제출 완료' : '입력 중'}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
