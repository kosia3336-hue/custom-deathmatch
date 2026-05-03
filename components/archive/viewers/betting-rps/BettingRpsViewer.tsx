'use client';

import { useState } from 'react';
import type { GameRecordFile, BettingRpsRecord, BettingRpsRoundAction } from '@/shared/types/archive';
import { formatTime } from '@/lib/utils';
import { WIN_TYPE_LABELS, RESULT_LABELS, RESULT_COLORS, OUTCOME_LABELS, OUTCOME_COLORS } from '@/components/game/modules/betting-rps/constants';

function RoundRow({
  action,
  playerIds,
  nicknames,
  isLast,
}: {
  action: BettingRpsRoundAction;
  playerIds: string[];
  nicknames: Record<string, string>;
  isLast: boolean;
}) {
  const pEntries = Object.entries(action.players);
  const matchEntry = pEntries.find(([, p]) => p.role === 'match');
  const betEntry = pEntries.find(([, p]) => p.role === 'bet');

  const choiceRightNick = nicknames[action.choiceRightPlayerId] ?? action.choiceRightPlayerId;

  return (
    <div
      className={`rounded-lg border p-3 text-sm space-y-2 ${
        isLast ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-500">R{action.round}</span>
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          선택권: {choiceRightNick}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Match player */}
        {matchEntry && (() => {
          const [pid, pd] = matchEntry;
          const result = pd.matchResult;
          return (
            <div className="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 space-y-0.5">
              <div className="text-[10px] text-blue-500 font-medium">승부 — {nicknames[pid] ?? pid}</div>
              <div className="flex items-center gap-1.5">
                {result && (
                  <span className={`text-sm font-bold ${RESULT_COLORS[result]}`}>
                    {RESULT_LABELS[result]}
                  </span>
                )}
                {pd.chipChange > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                    +{pd.chipChange}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {pd.chipsBefore}칩 → {pd.chipsAfter}칩
              </div>
            </div>
          );
        })()}

        {/* Bet player */}
        {betEntry && (() => {
          const [pid, pd] = betEntry;
          const prediction = pd.prediction;
          const outcome = pd.betOutcome;
          return (
            <div className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5 space-y-0.5">
              <div className="text-[10px] text-emerald-600 font-medium">베팅 — {nicknames[pid] ?? pid}</div>
              <div className="flex items-center gap-1">
                {prediction && (
                  <span className={`text-sm font-bold ${RESULT_COLORS[prediction]}`}>
                    {RESULT_LABELS[prediction]}
                  </span>
                )}
                {pd.betChips != null && (
                  <span className="text-xs text-gray-400">({pd.betChips}칩)</span>
                )}
                {outcome && (
                  <span className={`text-xs font-semibold ${OUTCOME_COLORS[outcome]}`}>
                    → {OUTCOME_LABELS[outcome]}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {pd.chipsBefore}칩 → {pd.chipsAfter}칩
                </span>
                {pd.chipChange !== 0 && (
                  <span className={`font-semibold tabular-nums ${pd.chipChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {pd.chipChange > 0 ? '+' : ''}{pd.chipChange}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

interface Props {
  record: GameRecordFile;
}

export default function BettingRpsViewer({ record }: Props) {
  const gameRecord = record.gameRecord as BettingRpsRecord | null;
  const [mobileOpen, setMobileOpen] = useState(true);
  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const actions = gameRecord.actions ?? [];

  const playerIds = Object.keys(gameRecord.players ?? record.players);
  const nicknames: Record<string, string> = {};
  for (const pid of playerIds) {
    nicknames[pid] = gameRecord.players?.[pid]?.nickname ?? record.players?.[pid]?.nickname ?? pid;
  }

  const winnerEntry = record.result.rankings.find((r) => r.rank === 1);
  const winnerNick = winnerEntry?.nickname;

  return (
    <div className="space-y-4">
      {/* Player bar */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        {playerIds.map((pid, i) => {
          const finalChips = gameRecord.finalChips?.[pid];
          return (
            <div key={pid} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-amber-400'}`} />
              <span className="text-sm font-bold text-gray-900">{nicknames[pid]}</span>
              {finalChips !== undefined && (
                <span className="text-xs text-gray-500">({finalChips}칩)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Round list */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="hidden border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 lg:flex">
          라운드 기록
        </div>
        <button
          className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          라운드 기록
          <span className="text-xs text-gray-400">{mobileOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        <div className={`space-y-2 p-3 ${!mobileOpen ? 'hidden lg:block' : ''}`}>
          {actions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">라운드 기록이 없습니다.</p>
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
              {winnerNick
                ? `${winnerNick} 승`
                : gameRecord.winType === 'draw'
                ? '무승부'
                : '알 수 없음'}
              {gameRecord.winType
                ? ` (${WIN_TYPE_LABELS[gameRecord.winType] ?? gameRecord.winType})`
                : ''}
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
