'use client';

import { useState } from 'react';
import type { GameRecordFile, WinningStreakArchiveRecord, WinningStreakRoundAction } from '@/shared/types/archive';
import type { WSCardType } from '@/shared/types/winning-streak';
import { formatTime } from '@/lib/utils';

const WIN_TYPE_LABELS: Record<string, string> = {
  streak: '최대 연승',
  wins: '총 승리 수',
  draw: '무승부',
  timeout: '시간 초과',
  abandon: '기권',
};

const CARD_STYLE: Record<WSCardType, { icon: string; bg: string; text: string }> = {
  spade: { icon: '♠', bg: 'bg-slate-800', text: 'text-white' },
  diamond: { icon: '♦', bg: 'bg-red-500', text: 'text-white' },
  heart: { icon: '♥', bg: 'bg-pink-500', text: 'text-white' },
  club: { icon: '♣', bg: 'bg-emerald-600', text: 'text-white' },
  blackJoker: { icon: '🃏', bg: 'bg-gray-400', text: 'text-gray-800' },
  colorJoker: { icon: '🃏', bg: 'bg-purple-500', text: 'text-white' },
};

const CARD_NAMES: Record<WSCardType, string> = {
  spade: '스페이드', diamond: '다이아몬드', heart: '하트',
  club: '클로버', blackJoker: '흑백조커', colorJoker: '컬러조커',
};

const RESULT_LABELS: Record<string, string> = {
  win: '승리',
  lose: '패배',
  draw_win: '양측 승리',
  draw_lose: '양측 패배',
};

function RoundRow({
  action, playerIds, nicknames, isLast, prevStreakAfterByPlayer,
}: {
  action: WinningStreakRoundAction;
  playerIds: string[];
  nicknames: Record<string, string>;
  isLast: boolean;
  /** 직전 라운드 종료 시점 연승 (첫 라운드는 0) */
  prevStreakAfterByPlayer: Record<string, number>;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        isLast ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className="grid gap-2"
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

          const streakBefore =
            pd.streakBefore ?? prevStreakAfterByPlayer[pid] ?? 0;

          const isWin = pd.result === 'win' || pd.result === 'draw_win';
          const cs = CARD_STYLE[pd.card];

          return (
            <div key={pid} className="flex flex-col gap-0.5 min-w-0">
              <span className="truncate font-medium text-gray-800">{nicknames[pid]}</span>
              <div>
                <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${cs.bg} ${cs.text}`}>
                  {cs.icon} {CARD_NAMES[pd.card]}
                </span>
              </div>
              <span className={`text-xs font-bold ${isWin ? 'text-emerald-600' : 'text-red-500'}`}>
                {RESULT_LABELS[pd.result] ?? pd.result}
              </span>
              <div className="text-xs text-gray-400">
                {streakBefore > 0 && <span className="mr-0.5">🔥</span>}
                {streakBefore}→{pd.streakAfter}
                <span className="ml-1.5">최대 {pd.maxStreakAfter}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 상성 설명 */}
      {action.matchDescription && (
        <p className="mt-2 text-xs text-gray-400">{action.matchDescription}</p>
      )}
    </div>
  );
}

interface Props {
  record: GameRecordFile;
}

export default function WinningStreakViewer({ record }: Props) {
  const gameRecord = record.gameRecord as WinningStreakArchiveRecord | null;
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
          const stats = gameRecord.finalStats?.[pid];
          return (
            <div key={pid} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-amber-400'}`} />
              <span className="text-sm font-bold text-gray-900">{nicknames[pid]}</span>
              {stats && (
                <span className="text-xs text-gray-500">
                  (최대 {stats.maxStreak}연승 / {stats.totalWins}승)
                </span>
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
            actions.map((action, idx) => {
              const prev = idx > 0 ? actions[idx - 1] : null;
              const prevStreakAfterByPlayer = Object.fromEntries(
                playerIds.map((pid) => [
                  pid,
                  prev?.players[pid]?.streakAfter ?? 0,
                ]),
              );
              return (
                <RoundRow
                  key={action.round}
                  action={action}
                  playerIds={playerIds}
                  nicknames={nicknames}
                  isLast={idx === actions.length - 1}
                  prevStreakAfterByPlayer={prevStreakAfterByPlayer}
                />
              );
            })
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
                : winnerNick ? `${winnerNick} 승` : '무승부'}
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
