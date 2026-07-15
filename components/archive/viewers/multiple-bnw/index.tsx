'use client';

import { useState } from 'react';
import type { GameRecordFile, MultipleBnwArchiveRecord, MultipleBnwRoundAction } from '@/shared/types/archive';
import { formatTime } from '@/lib/utils';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '점수 우위',
  suspectCount: '의심 성공 횟수',
  draw: '무승부',
  timeout: '시간 초과',
  abandon: '기권',
};

function RoundRow({
  action,
  playerIds,
  nicknames,
  isLast,
}: {
  action: MultipleBnwRoundAction;
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
      {/* 라운드 번호 */}
      <div className="flex items-start pt-0.5 pr-3 font-semibold text-gray-500">
        R{action.round}
      </div>

      {/* 플레이어별 칸 */}
      {playerIds.map((pid) => {
        const pd = action.players[pid];
        if (!pd) return <div key={pid} className="text-gray-300">-</div>;

        const isFirst = pid === action.firstPlayerId;
        const tileIcon = pd.tileColor === 'black' ? '■' : '□';
        const scoreChange = pd.totalScoreChange;

        return (
          <div key={pid} className="flex flex-col gap-0.5 min-w-0">
            {/* 닉네임 + 역할 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-gray-800 truncate">{nicknames[pid] ?? pid}</span>
              <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                {isFirst ? '선플' : '후플'}
              </span>
            </div>

            {/* 타일 + 의심 결과 */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className={`font-mono font-bold ${pd.tileColor === 'black' ? 'text-gray-900' : 'text-gray-500'}`}>
                {tileIcon} {pd.tile}
              </span>
              {pd.suspected ? (
                <span className={pd.suspectSuccess ? 'text-emerald-600' : 'text-red-500'}>
                  {pd.suspectSuccess ? '의심 성공' : '의심 실패'}
                </span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
              {pd.bonusPoint > 0 && (
                <span className="text-amber-500">+{pd.bonusPoint}보너스</span>
              )}
            </div>

            {/* 판정 상세 식 */}
            {pd.suspectDetail && (
              <div className="text-xs text-gray-400">{pd.suspectDetail}</div>
            )}

            {/* 점수 변화 */}
            <div className="text-xs text-gray-400">
              {pd.scoreBefore} →{' '}
              <span className="font-semibold text-gray-700">{pd.scoreAfter}점</span>
              {scoreChange !== 0 && (
                <span className={`ml-1 ${scoreChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ({scoreChange > 0 ? '+' : ''}{scoreChange})
                </span>
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

export default function MultipleBnwViewer({ record }: Props) {
  const gameRecord = record.gameRecord as MultipleBnwArchiveRecord | null;
  const [mobileOpen, setMobileOpen] = useState(true);
  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const actions = gameRecord.actions ?? [];

  const playerIds = Object.keys(gameRecord.players ?? record.players);
  const nicknames: Record<string, string> = {};
  for (const pid of playerIds) {
    nicknames[pid] =
      gameRecord.players?.[pid]?.nickname ?? record.players?.[pid]?.nickname ?? pid;
  }

  const winnerEntry = record.result.rankings.find((r) => r.rank === 1);
  const winnerNick = winnerEntry?.nickname;
  const winTypeLabel = gameRecord.winType ? (WIN_TYPE_LABELS[gameRecord.winType] ?? gameRecord.winType) : null;

  return (
    <div className="space-y-4">
      {/* 플레이어 바 */}
      <div className="flex flex-wrap items-center justify-center gap-8">
        {playerIds.map((pid, i) => {
          const score = record.result.rankings.find((r) => r.nickname === nicknames[pid])?.score;
          return (
            <div key={pid} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-amber-400'}`} />
              <span className="text-sm font-bold text-gray-900">{nicknames[pid]}</span>
              {score !== undefined && (
                <span className="text-xs text-gray-500">({score}점)</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 라운드 기록 */}
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

      {/* 게임 정보 요약 */}
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
              {winnerNick ? `${winnerNick} 승` : '무승부'}
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
