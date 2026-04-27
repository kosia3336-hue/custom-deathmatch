'use client';

import { useState } from 'react';
import type { GameRecordFile, BankGameArchiveRecord, BankRoundArchiveRecord } from '@/shared/types/archive';
import type { BankSide, BankDenomination } from '@/shared/types/bank-game';
import { BANK_DENOMINATIONS } from '@/shared/types/bank-game';
import {
  DENOM_ORDER,
  DENOM_STYLES,
  WIN_TYPE_LABELS,
  formatKRW,
} from '@/components/game/modules/bank-game/constants';
import { formatTime } from '@/lib/utils';

interface Props {
  record: GameRecordFile;
}

export default function BankGameViewer({ record }: Props) {
  const gameRecord = record.gameRecord as BankGameArchiveRecord;
  const sides = gameRecord.sides;
  const rounds = gameRecord.rounds ?? [];

  const nicknames: Record<BankSide, string> = {
    p1:
      gameRecord.players?.[sides.p1]?.nickname ??
      record.players?.[sides.p1]?.nickname ??
      'P1',
    p2:
      gameRecord.players?.[sides.p2]?.nickname ??
      record.players?.[sides.p2]?.nickname ??
      'P2',
  };

  const winnerSide: BankSide | null =
    gameRecord.winnerId === sides.p1 ? 'p1'
    : gameRecord.winnerId === sides.p2 ? 'p2'
    : null;

  const winTypeLabel = gameRecord.winType
    ? (WIN_TYPE_LABELS as Record<string, string>)[gameRecord.winType] ?? gameRecord.winType
    : null;

  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* 결과 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 lg:text-sm">최종 결과</span>
            <span className="text-xl font-bold text-gray-900 lg:text-3xl">
              {gameRecord.winType === 'draw' || !winnerSide
                ? '무승부'
                : `${nicknames[winnerSide]} 승리`}
            </span>
            {winTypeLabel && (
              <span className="text-xs text-gray-500 lg:text-sm">{winTypeLabel}</span>
            )}
            {gameRecord.finishReason && (
              <span className="text-[11px] text-gray-400">{gameRecord.finishReason}</span>
            )}
          </div>
          <div className="flex gap-8 lg:gap-12">
            {(['p1', 'p2'] as const).map((side) => {
              const isWinner = winnerSide === side;
              return (
                <div key={side} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 lg:text-sm">{nicknames[side]}</span>
                  <span
                    className={`text-2xl font-bold tabular-nums lg:text-4xl ${
                      isWinner ? 'text-emerald-600' : 'text-gray-700'
                    }`}
                  >
                    {gameRecord.finalScore[side] ?? 0}
                  </span>
                  <span className="text-[10px] text-gray-400 lg:text-xs">승점</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 라운드 기록 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-3 py-2 text-sm font-medium text-gray-700 lg:px-4 lg:py-3 lg:text-base">
          라운드 기록 ({rounds.length}R)
        </div>
        <div className="space-y-2 p-3 lg:p-4">
          {rounds.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">라운드 기록이 없습니다.</p>
          ) : (
            rounds.map((r) => (
              <RoundRow
                key={r.round}
                record={r}
                nicknames={nicknames}
                expanded={expandedRound === r.round}
                onToggle={() => setExpandedRound(expandedRound === r.round ? null : r.round)}
              />
            ))
          )}
        </div>
      </div>

      {/* 게임 메타 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 lg:p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 lg:gap-x-8 lg:text-base">
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
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </span>
          <span>
            <span className="text-gray-400">시간</span>{' '}
            <span className="font-medium text-gray-800">
              {formatTime(record.result.playTime)}
            </span>
          </span>
          <span>
            <span className="text-gray-400">라운드</span>{' '}
            <span className="font-medium text-gray-800">{rounds.length}R</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ════════════ 라운드 행 ════════════ */

function RoundRow({
  record,
  nicknames,
  expanded,
  onToggle,
}: {
  record: BankRoundArchiveRecord;
  nicknames: Record<BankSide, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const winColor =
    record.outcome === 'draw'
      ? 'bg-gray-100 text-gray-700'
      : record.outcome === 'first_win'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-violet-100 text-violet-700';
  const winLabel =
    record.outcome === 'draw'
      ? '무승부'
      : record.outcome === 'first_win'
        ? '선 승'
        : '후 승';

  const margin =
    record.outcome === 'draw' || !record.winnerSide || !record.loserSide
      ? null
      : record.amounts[record.winnerSide] - record.amounts[record.loserSide];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left transition-colors hover:bg-white lg:px-4 lg:py-3"
      >
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="shrink-0 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-600 lg:px-2.5 lg:text-sm">
            R{record.round}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold lg:px-2 lg:text-xs ${winColor}`}>
            {winLabel}
          </span>
          <span className="text-[10px] text-gray-400 lg:text-xs">
            선 👑 {nicknames[record.firstSide]}
          </span>
          {(record.auto.p1 || record.auto.p2) && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 lg:text-[11px]">
              ⚠ 자동
            </span>
          )}
          {margin != null && margin > 0 && margin <= 1000 && (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 lg:text-[11px]">
              초접전
            </span>
          )}
          {margin != null && margin >= 30000 && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 lg:text-[11px]">
              대승
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-gray-400 tabular-nums">
            {record.scoreAfter.p1} : {record.scoreAfter.p2}
          </span>
          <span className="shrink-0 text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-xs lg:mt-2 lg:gap-3 lg:text-sm">
          {(['p1', 'p2'] as const).map((side) => {
            const amount = record.amounts[side];
            const count = record.counts[side];
            const isWinner = record.winnerSide === side;
            return (
              <div
                key={side}
                className={`flex items-center justify-between rounded px-2 py-1 ${
                  isWinner ? 'bg-emerald-50' : 'bg-white'
                }`}
              >
                <span className="font-semibold text-gray-700">
                  {nicknames[side]} {isWinner && '🏆'}
                </span>
                <span className="text-gray-700 tabular-nums">
                  {count}장 / <b>{formatKRW(amount)}원</b>
                </span>
              </div>
            );
          })}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-gray-200 bg-white p-3 lg:p-4">
          <p className="text-[11px] font-semibold text-gray-500 lg:text-xs">
            액면별 베팅
          </p>
          {(['p1', 'p2'] as const).map((side) => (
            <BetBreakdownRow
              key={side}
              label={nicknames[side]}
              bet={record.bets[side]}
              isFirst={side === record.firstSide}
              isWinner={record.winnerSide === side}
            />
          ))}
          <p className="mt-3 text-[11px] font-semibold text-gray-500 lg:text-xs">
            라운드 후 잔여
          </p>
          {(['p1', 'p2'] as const).map((side) => (
            <InventoryRow
              key={side}
              label={nicknames[side]}
              inventory={record.inventoryAfter[side]}
              total={record.inventoryTotalCountAfter[side]}
              amount={record.inventoryTotalAmountAfter[side]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BetBreakdownRow({
  label,
  bet,
  isFirst,
  isWinner,
}: {
  label: string;
  bet: Record<BankDenomination, number>;
  isFirst: boolean;
  isWinner: boolean;
}) {
  const total = BANK_DENOMINATIONS.reduce((sum, d) => sum + bet[d] * d, 0);
  const count = BANK_DENOMINATIONS.reduce((sum, d) => sum + bet[d], 0);
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded px-2 py-1 text-[11px] lg:gap-3 lg:px-3 lg:py-2 lg:text-sm ${
        isWinner ? 'bg-emerald-50' : 'bg-gray-50'
      }`}
    >
      <span className="w-24 shrink-0 font-bold text-gray-700 lg:w-32">
        {label}
        {isFirst && <span className="ml-1 text-amber-500">👑</span>}
        {isWinner && <span className="ml-1">🏆</span>}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {DENOM_ORDER.map((d) => {
          const ds = DENOM_STYLES[d];
          const v = bet[d];
          return (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 tabular-nums font-semibold ${
                v > 0 ? `${ds.bgStrong} ${ds.textStrong}` : 'text-gray-300'
              }`}
            >
              {ds.shortLabel}×{v}
            </span>
          );
        })}
      </div>
      <span className="ml-auto shrink-0 text-gray-700 tabular-nums">
        {count}장 / <b>{formatKRW(total)}원</b>
      </span>
    </div>
  );
}

function InventoryRow({
  label,
  inventory,
  total,
  amount,
}: {
  label: string;
  inventory: Record<BankDenomination, number>;
  total: number;
  amount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded bg-gray-50 px-2 py-1 text-[11px] lg:gap-3 lg:px-3 lg:py-2 lg:text-sm">
      <span className="w-24 shrink-0 font-bold text-gray-700 lg:w-32">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        {DENOM_ORDER.map((d) => {
          const ds = DENOM_STYLES[d];
          const v = inventory[d];
          return (
            <span
              key={d}
              className={`rounded px-1.5 py-0.5 tabular-nums font-semibold ${
                v > 0 ? `${ds.bg} ${ds.text}` : 'text-gray-300'
              }`}
            >
              {ds.shortLabel}×{v}
            </span>
          );
        })}
      </div>
      <span className="ml-auto shrink-0 text-gray-700 tabular-nums">
        {total}장 / <b>{formatKRW(amount)}원</b>
      </span>
    </div>
  );
}
