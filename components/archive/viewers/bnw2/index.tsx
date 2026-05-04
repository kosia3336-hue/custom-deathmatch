'use client';

import { useState } from 'react';
import type { GameRecordFile, BNW2ArchiveRecord, BNW2RoundAction } from '@/shared/types/archive';
import { formatTime } from '@/lib/utils';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '10점 달성',
  exhaustion: '포인트 소진',
  draw: '무승부',
  timeout: '시간 초과',
  leave: '기권',
};

function ColorBadge({ color }: { color: 'black' | 'white' }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold ${
        color === 'black'
          ? 'bg-slate-800 text-slate-100'
          : 'border border-gray-300 bg-white text-slate-700'
      }`}
    >
      {color === 'black' ? '흑' : '백'}
    </span>
  );
}

function RoundRow({
  action,
  playerIds,
  nicknames,
  isLast,
}: {
  action: BNW2RoundAction;
  playerIds: string[];
  nicknames: Record<string, string>;
  isLast: boolean;
}) {
  const fpId = action.firstPlayerId;
  const firstPlayer = action.players[fpId];
  const secondId = playerIds.find(id => id !== fpId);
  const secondPlayer = secondId ? action.players[secondId] : undefined;

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        isLast ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr 1fr' }}>
        {/* Round number */}
        <div className="flex items-start pt-0.5 pr-3 font-semibold text-gray-400">
          R{action.round}
        </div>

        {/* Player columns */}
        {playerIds.map((pid) => {
          const pd = action.players[pid];
          if (!pd) return <div key={pid} className="text-gray-300">-</div>;

          const isFirst = pid === fpId;
          const isWinner = action.winnerId === pid;

          return (
            <div key={pid} className="flex flex-col gap-0.5 min-w-0">
              <span className="truncate text-xs font-medium text-gray-700">
                {nicknames[pid]}
                {isFirst && <span className="ml-1 text-amber-500">👑</span>}
                {isWinner && <span className="ml-1">🏆</span>}
              </span>
              <div className="flex items-center gap-1.5">
                <ColorBadge color={pd.color} />
                {pd.points != null && (
                  <span className="text-xs font-semibold tabular-nums text-gray-700">{pd.points}p</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {pd.scoreBefore}
                {pd.scoreChange > 0 && (
                  <span className="mx-0.5 font-semibold text-amber-600">+{pd.scoreChange}</span>
                )}
                → {pd.scoreAfter}점
              </div>
              <div className="text-[11px] text-gray-400">
                단계 {pd.stageBefore} → {pd.stageAfter}
              </div>
            </div>
          );
        })}
      </div>

      {!action.winnerId && (
        <p className="mt-1.5 text-xs text-gray-400">이 라운드 무승부</p>
      )}
    </div>
  );
}

interface Props {
  record: GameRecordFile;
}

export default function BNW2Viewer({ record }: Props) {
  const gameRecord = record.gameRecord as BNW2ArchiveRecord | null;
  const [mobileOpen, setMobileOpen] = useState(true);
  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const actions = gameRecord.actions ?? [];

  const playerIds = Object.keys(gameRecord.players ?? record.players);
  const nicknames: Record<string, string> = {};
  for (const pid of playerIds) {
    nicknames[pid] =
      gameRecord.players?.[pid]?.nickname ?? record.players?.[pid]?.nickname ?? pid;
  }

  const winnerEntry = record.result.rankings.find(r => r.rank === 1);
  const winnerNick = winnerEntry?.nickname;
  const winTypeLabel = gameRecord.winType ? (WIN_TYPE_LABELS[gameRecord.winType] ?? gameRecord.winType) : null;

  return (
    <div className="space-y-4">
      {/* Player bar */}
      <div className="flex flex-wrap items-center justify-center gap-8">
        {playerIds.map((pid, i) => {
          const finalScore = gameRecord.finalScores?.[pid] ?? record.result.rankings.find(r => r.rank === 1 && nicknames[pid] === r.nickname)?.score ?? 0;
          const finalPoints = gameRecord.finalPoints?.[pid];
          return (
            <div key={pid} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-amber-400'}`} />
              <span className="text-sm font-bold text-gray-900">{nicknames[pid]}</span>
              <span className="text-xs text-gray-500">
                ({finalScore}점{finalPoints !== undefined ? ` / ${finalPoints}p 잔여` : ''})
              </span>
            </div>
          );
        })}
      </div>

      {/* Round history */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="hidden lg:flex border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
          라운드 기록
        </div>
        <button
          className="flex lg:hidden w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-700"
          onClick={() => setMobileOpen(v => !v)}
        >
          라운드 기록
          <span className="text-xs text-gray-400">{mobileOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        <div className={`p-3 space-y-2 ${!mobileOpen ? 'hidden lg:block' : ''}`}>
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
            <span className="text-gray-400">결과</span>{' '}
            <span className="font-medium text-gray-800">
              {gameRecord.winType === 'draw'
                ? '무승부'
                : winnerNick ? `${winnerNick} 승` : '-'}
              {winTypeLabel ? ` (${winTypeLabel})` : ''}
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
