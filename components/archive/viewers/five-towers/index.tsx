'use client';

import { useMemo, useState } from 'react';
import type { GameRecordFile, FiveTowersArchiveRecord, FiveTowersActionRecord } from '@/shared/types/archive';
import type { FTTower } from '@/shared/types/five-towers';
import { FT_TOWER_MAX_HEIGHT, FT_HALF_MILESTONE } from '@/shared/types';
import { formatTime } from '@/lib/utils';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '3선승 달성',
  leave: '기권',
  timeout: '시간 초과',
};


const PLAYER_COLORS = ['bg-indigo-500', 'bg-amber-400'] as const;

function ItemBadge({ item }: { item: 'info' | 'zero' | 'secret' }) {
  const cfg = {
    info: { label: '정보', cls: 'bg-sky-100 text-sky-700 border-sky-300' },
    zero: { label: '제로', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    secret: { label: '시크릿', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  }[item];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}


interface ActionRowProps {
  action: FiveTowersActionRecord;
  height: number;
  playerColor: string;
}

function ActionRow({ action, height, playerColor }: ActionRowProps) {
  const desc = (() => {
    if (action.kind === 'stack') {
      return (
        <>
          <b>{action.tower}</b>탑에 <b>{action.count}칸</b> 쌓음
        </>
      );
    }
    if (action.kind === 'item-info') {
      return (
        <>
          <ItemBadge item="info" /> {action.targets?.[0]}+{action.targets?.[1]} 합 <b>{action.sum}</b>
        </>
      );
    }
    if (action.kind === 'item-zero') {
      return (
        <>
          <ItemBadge item="zero" /> <b>{action.tower}</b>탑 (0칸)
        </>
      );
    }
    if (action.kind === 'item-secret') {
      return (
        <>
          <ItemBadge item="secret" /> <b>{action.tower}</b>탑에 <b>{action.count}칸</b>
        </>
      );
    }
    return null;
  })();

  return (
    <li className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-xs">
      <span className="mt-0.5 inline-flex w-8 shrink-0 justify-center rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] tabular-nums text-gray-500">
        {action.turn}T
      </span>
      <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${playerColor}`} />
      <span className="flex-1 text-gray-700">
        <b>{action.actorNickname}</b> 이(가) {desc}
        {action.milestone === 'half' && (
          <span className="ml-1 rounded bg-yellow-200 px-1 text-[10px] font-bold text-yellow-800">6칸</span>
        )}
        {action.milestone === 'complete' && (
          <span className="ml-1 rounded bg-amber-400 px-1 text-[10px] font-bold text-white">완성 +1</span>
        )}
        <span className="ml-2 text-[10px] text-gray-400">
          누계 {action.tower ? `${action.tower}탑 ${height}` : ''}
        </span>
      </span>
    </li>
  );
}

export default function FiveTowersViewer({ record }: { record: GameRecordFile }) {
  const gameRecord = record.gameRecord as FiveTowersArchiveRecord | null;
  const [showFullLog, setShowFullLog] = useState(false);

  const playerIds = useMemo(
    () => (gameRecord?.players ? Object.keys(gameRecord.players) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameRecord],
  );
  const playerNames = useMemo(() => {
    if (!gameRecord?.players) return {} as Record<string, string>;
    const m: Record<string, string> = {};
    for (const [id, info] of Object.entries(gameRecord.players)) m[id] = info.nickname;
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRecord]);

  const playerColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    playerIds.forEach((id, i) => {
      map[id] = PLAYER_COLORS[i] ?? 'bg-gray-400';
    });
    return map;
  }, [playerIds]);

  // 각 액션 시점의 탑 누적 높이
  const actionHeights = useMemo(() => {
    if (!gameRecord?.actions) return [];
    const heights: Record<FTTower, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    return gameRecord.actions.map((a) => {
      if ((a.kind === 'stack' || a.kind === 'item-secret') && a.tower && a.count) {
        heights[a.tower] = Math.min(FT_TOWER_MAX_HEIGHT, heights[a.tower] + a.count);
      }
      return a.tower ? heights[a.tower] : 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRecord]);

  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const actions = gameRecord.actions ?? [];
  const visibleActions = showFullLog ? actions : actions.slice(-30);
  const visibleHeights = showFullLog ? actionHeights : actionHeights.slice(-30);

  const winnerNick =
    gameRecord.winnerId && playerNames[gameRecord.winnerId]
      ? playerNames[gameRecord.winnerId]
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{record.gameName}</h2>
            <p className="text-xs text-gray-500">
              {new Date(record.playedAt).toLocaleString()} ·{' '}
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? 'vs COM' : '솔로'} ·
              총 {gameRecord.totalTurns}턴 · 플레이타임 {formatTime(record.result.playTime)}
            </p>
          </div>
          <div className="flex flex-col items-end">
            {winnerNick ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                승: {winnerNick}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-600">
                무승부
              </span>
            )}
            {gameRecord.winType && (
              <span className="mt-1 text-xs text-gray-500">
                {WIN_TYPE_LABELS[gameRecord.winType] ?? gameRecord.winType}
              </span>
            )}
          </div>
        </div>
        {gameRecord.finishReason && (
          <p className="mt-2 text-xs text-gray-500">{gameRecord.finishReason}</p>
        )}
      </div>

      {/* 점수 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">최종 점수</h3>
        <div className="grid grid-cols-2 gap-2">
          {playerIds.map((pid, i) => (
            <div
              key={pid}
              className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 ${
                pid === gameRecord.winnerId ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${PLAYER_COLORS[i] ?? 'bg-gray-400'}`} />
                <span className="font-semibold text-gray-800">{playerNames[pid]}</span>
              </div>
              <span className="text-2xl font-black tabular-nums text-gray-800">
                {gameRecord.finalScores[pid] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 아이템 사용 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">아이템 사용</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {playerIds.map((pid, i) => {
            const usage = gameRecord.itemsUsed[pid];
            return (
              <div
                key={pid}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <span className={`h-3 w-3 rounded-full ${PLAYER_COLORS[i] ?? 'bg-gray-400'}`} />
                <span className="flex-1 font-semibold text-gray-800">{playerNames[pid]}</span>
                {usage ? (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <ItemBadge item={usage.item} />
                    <span className="text-gray-400">·</span>
                    <span className="font-mono">{usage.turn}T</span>
                    <span className="text-gray-700">
                      {usage.item === 'info' && (
                        <>
                          {usage.detail.targets?.[0]}+{usage.detail.targets?.[1]} = {usage.detail.sum}
                        </>
                      )}
                      {usage.item === 'zero' && <>{usage.detail.tower}탑 (0칸)</>}
                      {usage.item === 'secret' && (
                        <>
                          {usage.detail.tower}탑 +{usage.detail.count}칸
                        </>
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">미사용</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 액션 타임라인 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">액션 타임라인</h3>
          {actions.length > 30 && (
            <button
              type="button"
              onClick={() => setShowFullLog((v) => !v)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {showFullLog ? '최근 30개만' : `전체 ${actions.length}개 보기`}
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-1">
          {visibleActions.map((a, i) => (
            <ActionRow
              key={`${a.turn}-${i}`}
              action={a}
              height={visibleHeights[i]}
              playerColor={playerColorMap[a.actorId] ?? 'bg-gray-400'}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
