'use client';

import { useState } from 'react';
import type { GameRecordFile, NumberFourRecord, NumberFourRoundAction } from '@/shared/types/archive';
import { formatTime } from '@/lib/utils';

const WIN_TYPE_LABEL: Record<string, string> = {
  score: '점수 승리',
  elimination: '상대 탈락',
  tiebreaker: '동점 승부',
  timeout: '시간 초과',
};

interface Props {
  record: GameRecordFile;
}

function RoundRow({
  action,
  playerIds,
  nicknames,
  isLast,
}: {
  action: NumberFourRoundAction;
  playerIds: string[];
  nicknames: Record<string, string>;
  isLast: boolean;
}) {
  return (
    <div
      className={`grid gap-2 rounded-lg border p-3 text-sm ${
        isLast
          ? 'border-indigo-200 bg-indigo-50'
          : 'border-gray-200 bg-white'
      }`}
      style={{ gridTemplateColumns: `auto 1fr 1fr` }}
    >
      {/* 라운드 번호 */}
      <div className="flex items-center font-semibold text-gray-500 pr-3">
        R{action.round}
      </div>

      {playerIds.map((pid) => {
        const p = action.players[pid];
        if (!p) return <div key={pid} className="text-gray-300">-</div>;
        const success = p.success;
        return (
          <div key={pid} className="flex flex-col gap-0.5">
            <div className="font-medium text-gray-800 truncate">{nicknames[pid] ?? pid}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                N{p.number}
              </span>
              <span className="text-xs text-gray-500">□{p.white} ■{p.black}</span>
              <span className={success ? 'text-emerald-600' : 'text-red-500'}>
                {success ? '✅' : '❌'}{' '}
                {p.scoreChange > 0 ? `+${p.scoreChange}` : p.scoreChange}점
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {p.scoreBefore} → <span className="font-semibold text-gray-700">{p.scoreAfter}점</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Number4Viewer({ record }: Props) {
  const gameRecord = record.gameRecord as NumberFourRecord;
  const actions = gameRecord.actions ?? [];

  const playerIds = Object.keys(gameRecord.players ?? record.players);
  const nicknames: Record<string, string> = {};
  for (const pid of playerIds) {
    nicknames[pid] =
      gameRecord.players?.[pid]?.nickname ?? record.players?.[pid]?.nickname ?? pid;
  }

  const winnerNick = record.result.rankings.find((r) => r.rank === 1)?.nickname;

  const [mobileOpen, setMobileOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Player bar */}
      <div className="flex items-center justify-center gap-8 flex-wrap">
        {playerIds.map((pid, i) => {
          const score = gameRecord.finalScores?.[pid] ?? record.result.rankings.find(
            (r) => r.nickname === nicknames[pid],
          )?.score;
          return (
            <div key={pid} className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full ${
                  i === 0 ? 'bg-indigo-500' : 'bg-amber-400'
                }`}
              />
              <span className="text-sm font-bold text-gray-900">{nicknames[pid]}</span>
              {score !== undefined && (
                <span className="text-xs text-gray-500">({score}점)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Round list — desktop always visible, mobile collapsible */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {/* Desktop header */}
        <div className="hidden lg:flex border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
          라운드 기록
        </div>

        {/* Mobile header with toggle */}
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

      {/* Game info summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>
            <span className="text-gray-400">게임</span>{' '}
            <span className="font-medium text-gray-800">{record.gameName}</span>
          </span>
          <span>
            <span className="text-gray-400">모드</span>{' '}
            <span className="font-medium text-gray-800">
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? '1:COM' : '1:1 솔로'}
            </span>
          </span>
          <span>
            <span className="text-gray-400">일시</span>{' '}
            <span className="font-medium text-gray-800">
              {new Date(record.playedAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
          <span>
            <span className="text-gray-400">결과</span>{' '}
            <span className="font-medium text-gray-800">
              {winnerNick ? `${winnerNick} 승` : '알 수 없음'}
              {gameRecord.winType
                ? ` (${WIN_TYPE_LABEL[gameRecord.winType] ?? gameRecord.winType})`
                : ''}
            </span>
          </span>
          {gameRecord.tiebreakerReason && (
            <span>
              <span className="text-gray-400">동점 결과</span>{' '}
              <span className="font-medium text-gray-800">{gameRecord.tiebreakerReason}</span>
            </span>
          )}
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
