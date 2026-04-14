'use client';

import type { BRPSPlayerInfo, BRPSRoundRecord } from '@/shared/types/betting-rps';

interface Props {
  players: Record<string, BRPSPlayerInfo>;
  myId: string;
  isSpectator?: boolean;
}

export default function PlayerStatusCard({ players, myId, isSpectator }: Props) {
  const pIds = Object.keys(players);

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2">
      {pIds.map((pid, idx) => {
        const p = players[pid];
        const isMe = !isSpectator && pid === myId;

        let roleLabel = '';
        if (p.role === 'match') roleLabel = '승부';
        else if (p.role === 'bet') roleLabel = '베팅';

        return (
          <div key={pid}>
            {idx > 0 && <div className="my-1.5 border-t border-gray-100" />}

            <div className="flex items-center justify-between gap-3">
              {/* Nickname */}
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`min-w-0 truncate text-sm ${
                    isMe ? 'font-bold text-indigo-700' : 'font-medium text-gray-700'
                  }`}
                >
                  {p.nickname}
                  {isMe && (
                    <span className="ml-1 text-xs font-normal text-indigo-400">(나)</span>
                  )}
                </span>
                {!isSpectator && p.hasChoiceRight && (
                  <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                    선택권
                  </span>
                )}
                {!isSpectator && roleLabel && (
                  <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-600">
                    {roleLabel}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {/* Chips */}
                <span className="text-sm font-bold tabular-nums text-gray-700">
                  {p.chips}칩
                </span>

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
