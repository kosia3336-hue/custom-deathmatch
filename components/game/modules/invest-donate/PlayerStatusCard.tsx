'use client';

import type { IDPlayerInfo, IDRoundRecord } from '@/shared/types/invest-donate';

interface Props {
  players: Record<string, IDPlayerInfo>;
  roundHistory: IDRoundRecord[];
  myId: string;
  isSpectator?: boolean;
}

function calcBadgeCounts(pid: string, history: IDRoundRecord[]) {
  let major = 0;
  let miser = 0;
  for (const r of history) {
    const pr = r.players[pid];
    if (!pr) continue;
    if (pr.investBadge === 'majorShareholder') major++;
    if (pr.donateBadge === 'miser') miser++;
  }
  return { major, miser };
}

export default function PlayerStatusCard({ players, roundHistory, myId, isSpectator }: Props) {
  const pIds = Object.keys(players).sort(
    (a, b) => Number(!isSpectator && b === myId) - Number(!isSpectator && a === myId),
  );

  return (
    <div data-panel-inset className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2">
      {pIds.map((pid, idx) => {
        const p = players[pid];
        const isMe = !isSpectator && pid === myId;
        const { major, miser } = calcBadgeCounts(pid, roundHistory);
        const showDot = !isMe || isSpectator;

        return (
          <div key={pid}>
            {idx > 0 && <div className="my-1.5 border-t border-gray-100" />}

            {/* 4-column grid: [nickname+score | ○count | ●count | dot] */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3">
              {/* Col 1: nickname + score */}
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`min-w-0 truncate text-sm ${
                    isMe ? 'font-bold text-indigo-700' : 'font-medium text-gray-700'
                  }`}
                >
                  {p.nickname}
                  {isMe && <span className="ml-1 text-xs font-normal text-indigo-400">(나)</span>}
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    p.score <= 1 ? 'animate-pulse text-red-500' : 'text-gray-700'
                  }`}
                >
                  {p.score}점
                </span>
              </div>

              {/* Col 2: 대주주 횟수 */}
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full border border-amber-500 bg-transparent" />
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    major === 0 ? 'text-gray-300' : 'text-amber-700'
                  }`}
                >
                  {major}
                </span>
              </span>

              {/* Col 3: 수전노 횟수 */}
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    miser === 0 ? 'text-gray-300' : 'text-red-600'
                  }`}
                >
                  {miser}
                </span>
              </span>

              {/* Col 4: 제출 여부 dot */}
              {showDot ? (
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                    p.submitted ? 'bg-emerald-500' : 'animate-pulse bg-gray-300'
                  }`}
                  title={p.submitted ? '제출 완료' : '입력 중'}
                />
              ) : (
                <span className="inline-block h-2.5 w-2.5 shrink-0" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
