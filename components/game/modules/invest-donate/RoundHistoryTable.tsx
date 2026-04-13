'use client';

import type { IDPlayerInfo, IDRoundRecord } from '@/shared/types/invest-donate';

interface Props {
  history: IDRoundRecord[];
  players: Record<string, IDPlayerInfo>;
  /** 좁은 공간(모바일)에서 대주주·수전노 열 숨김 */
  compact?: boolean;
}

function getMajorNick(r: IDRoundRecord, players: Record<string, IDPlayerInfo>): string {
  const majorPid = Object.keys(r.players).find(
    (pid) => r.players[pid]?.investBadge === 'majorShareholder',
  );
  if (!majorPid) return '공동';
  return players[majorPid]?.nickname ?? '???';
}

function getMiserNick(r: IDRoundRecord, players: Record<string, IDPlayerInfo>): string {
  const miserPids = Object.keys(r.players).filter(
    (pid) => r.players[pid]?.donateBadge === 'miser',
  );
  if (miserPids.length === 0) return '없음';
  return miserPids.map((pid) => players[pid]?.nickname ?? '???').join('·');
}

export default function RoundHistoryTable({ history, players, compact }: Props) {
  if (history.length === 0) return null;

  const pIds = Object.keys(players);

  return (
    <div className="w-full overflow-hidden">
      {/* Header */}
      <div
        className={`grid items-center gap-x-2 pb-0.5 text-[10px] font-medium text-gray-400 ${
          compact ? 'grid-cols-[28px_44px_44px]' : 'grid-cols-[28px_44px_44px_1fr_1fr]'
        }`}
      >
        <span />
        <span className="text-right whitespace-nowrap">투자</span>
        <span className="text-right whitespace-nowrap">기부</span>
        {!compact && (
          <span className="whitespace-nowrap break-keep">대주주</span>
        )}
        {!compact && (
          <span className="whitespace-nowrap break-keep">수전노</span>
        )}
      </div>

      <div className="border-t border-gray-100 pt-1 space-y-0.5">
        {history.map((r) => {
          const totalInvest = pIds.reduce((s, pid) => s + (r.players[pid]?.investTotal ?? 0), 0);
          const totalDonate = pIds.reduce((s, pid) => s + (r.players[pid]?.donateTotal ?? 0), 0);
          const majorNick = getMajorNick(r, players);
          const miserNick = getMiserNick(r, players);
          const isMajorTied = majorNick === '공동';
          const isMiserNone = miserNick === '없음';

          return (
            <div
              key={r.round}
              className={`grid items-baseline gap-x-2 text-[11px] ${
                compact ? 'grid-cols-[28px_44px_44px]' : 'grid-cols-[28px_44px_44px_1fr_1fr]'
              }`}
            >
              {/* R번호 */}
              <span className="font-medium text-gray-400">R{r.round}</span>

              {/* 투자 합계 */}
              <span className="text-right tabular-nums font-semibold text-blue-600">
                {totalInvest}원
              </span>

              {/* 기부 합계 */}
              <span className="text-right tabular-nums font-semibold text-emerald-600">
                {totalDonate}원
              </span>

              {/* 대주주 */}
              {!compact && (
                <span
                  className={`min-w-0 truncate break-keep ${
                    isMajorTied ? 'text-gray-400' : 'font-medium text-amber-700'
                  }`}
                >
                  {majorNick}
                </span>
              )}

              {/* 수전노 */}
              {!compact && (
                <span
                  className={`min-w-0 truncate break-keep ${
                    isMiserNone ? 'text-gray-300' : 'font-medium text-red-600'
                  }`}
                >
                  {miserNick}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
