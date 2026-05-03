'use client';

import { useState } from 'react';
import type { GameRecordFile, InvestDonateRecord, InvestDonateRoundAction } from '@/shared/types/archive';
import type { IDCoinAllocation } from '@/shared/types/invest-donate';
import { stockTotal } from '@/shared/types/invest-donate';
import { formatTime } from '@/lib/utils';
import { WIN_TYPE_LABELS } from '@/components/game/modules/invest-donate/constants';

function coinSummary(alloc: IDCoinAllocation): string {
  const parts: string[] = [];
  if (alloc.coin50 > 0) parts.push(`50×${alloc.coin50}`);
  if (alloc.coin10 > 0) parts.push(`10×${alloc.coin10}`);
  if (alloc.coin1 > 0) parts.push(`1×${alloc.coin1}`);
  return parts.length > 0 ? parts.join(' ') : '0';
}

function BadgeLabel({ investBadge, donateBadge }: { investBadge: string | null; donateBadge: string | null }) {
  const badges: React.ReactNode[] = [];
  if (investBadge === 'majorShareholder') {
    badges.push(
      <span
        key="i"
        className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700"
      >
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full border border-amber-500" />
        대주주
      </span>,
    );
  }
  if (donateBadge === 'miser') {
    badges.push(
      <span
        key="d"
        className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red-600"
      >
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
        수전노
      </span>,
    );
  }
  return (
    <span className="flex flex-col items-start gap-0.5 sm:inline-flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-1">
      {badges}
    </span>
  );
}

function RoundRow({
  action,
  playerIds,
  nicknames,
  isLast,
}: {
  action: InvestDonateRoundAction;
  playerIds: string[];
  nicknames: Record<string, string>;
  isLast: boolean;
}) {
  return (
    <div
      className={`grid gap-2 rounded-lg border p-3 text-sm ${
        isLast ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
      style={{ gridTemplateColumns: 'auto 1fr 1fr' }}
    >
      <div className="flex items-center font-semibold text-gray-500 pr-3">R{action.round}</div>
      {playerIds.map((pid) => {
        const p = action.players[pid];
        if (!p) return <div key={pid} className="text-gray-300">-</div>;
        return (
          <div key={pid} className="min-w-0 flex flex-col gap-0.5">
            <div className="truncate font-medium text-gray-800">{nicknames[pid] ?? pid}</div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
              <span className="shrink-0 whitespace-nowrap text-blue-500">투{p.investTotal}원</span>
              <span className="shrink-0 whitespace-nowrap text-emerald-500">기{p.donateTotal}원</span>
              <span className="min-w-0 break-all text-gray-400">
                ({coinSummary(p.investCoins)}/{coinSummary(p.donateCoins)})
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5">
              <BadgeLabel investBadge={p.investBadge} donateBadge={p.donateBadge} />
              <span
                className={`shrink-0 whitespace-nowrap ${
                  p.scoreChange > 0 ? 'text-emerald-600' : p.scoreChange < 0 ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {p.scoreChange > 0 ? `+${p.scoreChange}` : p.scoreChange}점
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {p.scoreBefore} → <span className="font-semibold text-gray-700">{p.scoreAfter}점</span>
              {p.coinStockAfter && (
                <span className="ml-1">잔여 {stockTotal(p.coinStockAfter)}원</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  record: GameRecordFile;
}

export default function InvestDonateViewer({ record }: Props) {
  const gameRecord = record.gameRecord as InvestDonateRecord | null;
  const [mobileOpen, setMobileOpen] = useState(true);
  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const actions = gameRecord.actions ?? [];

  const playerIds = Object.keys(gameRecord.players ?? record.players);
  const nicknames: Record<string, string> = {};
  for (const pid of playerIds) {
    nicknames[pid] = gameRecord.players?.[pid]?.nickname ?? record.players?.[pid]?.nickname ?? pid;
  }

  const winnerNick = record.result.rankings.find((r) => r.rank === 1)?.nickname;

  return (
    <div className="space-y-4">
      {/* Player bar */}
      <div className="flex items-center justify-center gap-8 flex-wrap">
        {playerIds.map((pid, i) => {
          const score = gameRecord.finalScores?.[pid] ?? record.result.rankings.find(
            (r) => r.nickname === nicknames[pid],
          )?.score;
          const coinStock = gameRecord.finalCoinStocks?.[pid];
          return (
            <div key={pid} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-amber-400'}`} />
              <span className="text-sm font-bold text-gray-900">{nicknames[pid]}</span>
              {score !== undefined && <span className="text-xs text-gray-500">({score}점)</span>}
              {coinStock && <span className="text-xs text-gray-400">{stockTotal(coinStock)}원</span>}
            </div>
          );
        })}
      </div>

      {/* Round list */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="hidden lg:flex border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
          라운드 기록
        </div>
        <button
          className="flex lg:hidden w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-700"
          onClick={() => setMobileOpen((v) => !v)}
        >
          라운드 기록
          <span className="text-xs text-gray-400">{mobileOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        <div className={`p-3 space-y-2 ${!mobileOpen ? 'hidden lg:block' : ''}`}>
          {actions.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">라운드 기록이 없습니다.</p>
          ) : (
            actions.map((action, idx) => (
              <RoundRow
                key={action.round}
                action={action}
                playerIds={playerIds}
                nicknames={nicknames}
                isLast={idx === actions.length - 1}
              />
            ))
          )}
        </div>
      </div>

      {/* Game info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>
            <span className="text-gray-400">게임</span>{' '}
            <span className="font-medium text-gray-800">{record.gameName}</span>
          </span>
          <span>
            <span className="text-gray-400">모드</span>{' '}
            <span className="font-medium text-gray-800">
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? '1:COM' : '솔로'}
            </span>
          </span>
          <span>
            <span className="text-gray-400">일시</span>{' '}
            <span className="font-medium text-gray-800">
              {new Date(record.playedAt).toLocaleDateString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </span>
          <span>
            <span className="text-gray-400">결과</span>{' '}
            <span className="font-medium text-gray-800">
              {winnerNick ? `${winnerNick} 승` : '알 수 없음'}
              {gameRecord.winType ? ` (${WIN_TYPE_LABELS[gameRecord.winType] ?? gameRecord.winType})` : ''}
            </span>
          </span>
          <span>
            <span className="text-gray-400">시간</span>{' '}
            <span className="font-medium text-gray-800">{formatTime(record.result.playTime)}</span>
          </span>
          <span>
            <span className="text-gray-400">라운드</span>{' '}
            <span className="font-medium text-gray-800">{actions.length}라운드</span>
          </span>
        </div>
      </div>
    </div>
  );
}
