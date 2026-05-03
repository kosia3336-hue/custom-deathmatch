'use client';

import { useState } from 'react';
import type { GameRecordFile, SilperBnwArchiveRecord } from '@/shared/types/archive';
import type { SBNWRoundRecord, SBNWSegmentSummary, SBNWTile } from '@/shared/types/silper-bnw';
import { formatTime } from '@/lib/utils';

/* ──────────── 상수 ──────────── */

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '6선승 달성',
  tiebreakTile: '잔여 타일 비교',
  rematch: '재대결 종료',
  autoLoss: '연속 미제출 패배',
  timeout: '시간 초과',
  leave: '기권',
  draw: '무승부',
};

const SEG_RES_LABELS: Record<string, string> = {
  score: '6선승',
  tiebreakTile: '잔여 타일',
  rematchNeeded: '재대결 진행',
  continuing: '중단',
};

const TILE_VALUES: SBNWTile[] = [0, 1, 2, 3, 4];

/** 타일별 색상 팔레트 (게임 UI와 동일) */
const TILE_COLORS: Record<SBNWTile, { bg: string; border: string; text: string; bar: string }> = {
  0: { bg: 'bg-slate-100',  border: 'border-slate-300',  text: 'text-slate-700',  bar: 'bg-slate-400'  },
  1: { bg: 'bg-sky-50',     border: 'border-sky-300',    text: 'text-sky-800',    bar: 'bg-sky-400'    },
  2: { bg: 'bg-teal-50',    border: 'border-teal-300',   text: 'text-teal-800',   bar: 'bg-teal-400'   },
  3: { bg: 'bg-orange-50',  border: 'border-orange-300', text: 'text-orange-800', bar: 'bg-orange-400' },
  4: { bg: 'bg-rose-50',    border: 'border-rose-400',   text: 'text-rose-800',   bar: 'bg-rose-400'   },
};

const PLAYER_COLORS = ['bg-indigo-500', 'bg-amber-400'] as const;

/* ──────────── 순수 함수 ──────────── */

function totalTiles(pool: Record<SBNWTile, number>): number {
  return TILE_VALUES.reduce<number>((s, t) => s + (pool[t] ?? 0), 0);
}

/* ──────────── 소형 컴포넌트 ──────────── */

/** 타일 숫자 칩 */
function TileChip({ tile }: { tile: SBNWTile }) {
  const c = TILE_COLORS[tile];
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold
        ${c.bg} ${c.border} ${c.text}`}
    >
      {tile}
    </span>
  );
}

/** 타일 배열 + 값 표시 */
function TileDisplay({ tiles, valueStr }: { tiles: SBNWTile[]; valueStr: string }) {
  if (tiles.length === 0) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-0.5">
        {tiles.map((t, i) => <TileChip key={i} tile={t} />)}
      </div>
      <span className="font-mono text-sm font-semibold text-gray-800 tabular-nums">
        = {valueStr}
        <span className="ml-1.5 text-xs font-normal text-gray-400">{tiles.length}자리</span>
      </span>
    </div>
  );
}

/** 잔여 타일 풀 뱃지 목록 */
function TilePool({ pool }: { pool: Record<SBNWTile, number> | undefined }) {
  if (!pool) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {TILE_VALUES.map((t) => {
        const count = pool[t] ?? 0;
        const c = TILE_COLORS[t];
        return (
          <span
            key={t}
            className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-medium
              ${count > 0 ? `${c.bg} ${c.border} ${c.text}` : 'border-gray-100 bg-gray-50 text-gray-300'}`}
          >
            <span className="font-bold">{t}</span>
            <span className="opacity-50">×</span>
            <span className="tabular-nums">{count}</span>
          </span>
        );
      })}
    </div>
  );
}

/** 스코어 변화 표시 */
function ScoreDelta({ before, after, change }: { before: number; after: number; change: number }) {
  return (
    <span className="text-xs tabular-nums text-gray-500">
      {before}점
      {change > 0 ? (
        <span className="mx-0.5 font-bold text-emerald-600">+{change}</span>
      ) : (
        <span className="mx-0.5 text-gray-300">▶</span>
      )}
      {after}점
    </span>
  );
}

/* ──────────── 라운드 행 (데스크톱: 3칸 그리드) ──────────── */

function RoundRow({
  record,
  playerIds,
  isLast,
}: {
  record: SBNWRoundRecord;
  /** 열 순서가 이미 고정된 배열 (세그먼트 시작 선플이 index 0) */
  playerIds: string[];
  isLast: boolean;
}) {
  const fpId = record.firstPlayerId;
  const hasWinner = record.winnerId !== null;

  return (
    <div
      className={`overflow-hidden rounded-xl border text-sm transition-colors
        ${isLast ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-white'}`}
    >
      {/* 라운드 번호 헤더 */}
      <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold
        ${isLast ? 'bg-indigo-100/70 text-indigo-700' : 'bg-gray-50 text-gray-500'}`}
      >
        <span>R{record.round}</span>
        {!hasWinner && (
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">무승부</span>
        )}
      </div>

      {/* 플레이어 2열 */}
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        {playerIds.map((pid, colIdx) => {
          const pd = record.players[pid];
          if (!pd) return <div key={pid} className="p-3 text-gray-300">—</div>;

          const isFirst = pid === fpId;
          const isWinner = record.winnerId === pid;

          return (
            <div
              key={pid}
              className={`flex flex-col gap-2 p-3
                ${isWinner ? 'bg-emerald-50/60' : ''}`}
            >
              {/* 닉네임 + 역할 + 승패 */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${PLAYER_COLORS[colIdx]}`} />
                <span className="font-medium text-gray-800">{pd.nickname}</span>
                {isFirst && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    선
                  </span>
                )}
                {isWinner && (
                  <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    ✓ 승
                  </span>
                )}
              </div>

              {/* 타일 + 값 */}
              <TileDisplay tiles={pd.tilesUsed} valueStr={pd.valueStr} />

              {/* 점수 변화 */}
              <ScoreDelta before={pd.scoreBefore} after={pd.scoreAfter} change={pd.scoreChange} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────── 세그먼트 탭 컨텐츠 ──────────── */

function SegmentContent({
  seg,
  playerIds,
  nicknames,
}: {
  seg: SBNWSegmentSummary;
  playerIds: string[];
  nicknames: Record<string, string>;
}) {
  // 세그먼트 시작 시점의 선 플레이어를 왼쪽(index 0)으로 고정
  const orderedPlayerIds =
    seg.firstPlayerIdAtStart && playerIds.includes(seg.firstPlayerIdAtStart)
      ? [seg.firstPlayerIdAtStart, ...playerIds.filter((id) => id !== seg.firstPlayerIdAtStart)]
      : playerIds;

  return (
    <div className="space-y-4">
      {/* 세그먼트 결과 요약 (재대결 세그먼트에만 헤더 표시) */}
      {seg.rematchIndex > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <span className="font-semibold">재대결 {seg.rematchIndex}회차</span>
          <span className="text-amber-300">·</span>
          <span>
            선 시작:{' '}
            <span className="font-medium">{nicknames[seg.firstPlayerIdAtStart] ?? seg.firstPlayerIdAtStart}</span>
          </span>
          <span className="text-amber-300">·</span>
          <span>
            결과:{' '}
            <span className="font-medium">
              {SEG_RES_LABELS[seg.resolution] ?? seg.resolution}
              {seg.winnerId ? ` — ${nicknames[seg.winnerId] ?? seg.winnerId} 승` : ''}
            </span>
          </span>
        </div>
      )}

      {/* 라운드 기록 */}
      <div className="space-y-2">
        {seg.rounds.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
            기록된 라운드가 없습니다.
          </div>
        ) : (
          seg.rounds.map((r, idx) => (
            <RoundRow
              key={`${r.rematchIndex}-${r.round}`}
              record={r}
              playerIds={orderedPlayerIds}
              isLast={idx === seg.rounds.length - 1}
            />
          ))
        )}
      </div>

      {/* 세그먼트 최종 타일 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {orderedPlayerIds.map((pid, pi) => {
          const score = seg.finalScores[pid] ?? 0;
          const pool = seg.finalTiles[pid];
          const remaining = pool ? totalTiles(pool) : null;
          return (
            <div
              key={pid}
              className={`rounded-xl border p-3
                ${seg.winnerId === pid ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${PLAYER_COLORS[pi]}`} />
                  <span className="text-sm font-semibold text-gray-800">{nicknames[pid] ?? pid}</span>
                </div>
                <span className="text-sm font-bold text-gray-700">
                  {score}점
                  {remaining !== null && (
                    <span className="ml-1 text-xs font-normal text-gray-400">/ {remaining}타일</span>
                  )}
                </span>
              </div>
              <TilePool pool={pool} />
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* ──────────── 메인 뷰어 ──────────── */

interface Props {
  record: GameRecordFile;
}

export default function SilperBnwViewer({ record }: Props) {
  const gameRecord = record.gameRecord as SilperBnwArchiveRecord | null;
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const segments: SBNWSegmentSummary[] = gameRecord.segmentsHistory ?? [];

  const playerIds = Object.keys(gameRecord.players ?? record.players);
  const nicknames: Record<string, string> = {};
  for (const pid of playerIds) {
    nicknames[pid] =
      gameRecord.players?.[pid]?.nickname ?? record.players?.[pid]?.nickname ?? pid;
  }

  const winnerNick = gameRecord.winnerId
    ? (nicknames[gameRecord.winnerId] ?? gameRecord.winnerId)
    : null;
  const winTypeLabel = gameRecord.winType
    ? (WIN_TYPE_LABELS[gameRecord.winType] ?? gameRecord.winType)
    : null;

  const isDraw = gameRecord.winType === 'draw';
  const totalRoundsPlayed =
    gameRecord.totalRounds ??
    segments.reduce((sum, seg) => sum + seg.rounds.length, 0);
  const activeSeg = segments[activeSegIdx];

  /* ── 렌더 ── */
  return (
    <div className="space-y-5">

      {/* ── 결과 헤더 ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* 상단 타이틀 바 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{record.gameName}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? '1:COM' : '솔로'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>
              {new Date(record.playedAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>⏱ {formatTime(record.result.playTime)}</span>
          </div>
        </div>

        {/* 플레이어 승패 카드 */}
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {playerIds.map((pid, i) => {
            const finalScore = gameRecord.finalScores?.[pid] ?? 0;
            const finalPool  = gameRecord.finalTiles?.[pid];
            const remaining  = finalPool ? totalTiles(finalPool) : null;
            const isWinner   = gameRecord.winnerId === pid;

            return (
              <div
                key={pid}
                className={`flex flex-col gap-2 p-4
                  ${isWinner ? 'bg-emerald-50/50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${PLAYER_COLORS[i]}`} />
                  <span className="font-bold text-gray-900 truncate">{nicknames[pid]}</span>
                  {isWinner && !isDraw && (
                    <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      승리
                    </span>
                  )}
                  {isDraw && (
                    <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                      무승부
                    </span>
                  )}
                </div>
                <div className="text-3xl font-black tabular-nums text-gray-900">
                  {finalScore}
                  <span className="ml-0.5 text-base font-normal text-gray-400">점</span>
                </div>
                {remaining !== null && (
                  <div className="text-xs text-gray-400">잔여 {remaining}타일</div>
                )}
                {finalPool && <TilePool pool={finalPool} />}
              </div>
            );
          })}
        </div>

        {/* 결과 요약 한 줄 */}
        <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
          {isDraw ? (
            <span className="font-medium text-gray-600">무승부</span>
          ) : winnerNick ? (
            <>
              <span className="font-semibold text-gray-800">{winnerNick}</span> 승
              {winTypeLabel && <span className="ml-1 text-gray-400">({winTypeLabel})</span>}
            </>
          ) : null}
          <span className="ml-3 text-gray-400">
            총 {totalRoundsPlayed}라운드
            {gameRecord.rematchCount > 0 && ` · 재대결 ${gameRecord.rematchCount}회`}
          </span>
        </div>
      </div>

      {/* ── 세그먼트 탭 + 콘텐츠 ── */}
      {segments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {/* 탭 바 */}
          {segments.length > 1 && (
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1">
              {segments.map((seg, idx) => {
                const label = seg.rematchIndex === 0 ? '본경기' : `재대결 ${seg.rematchIndex}`;
                const isActive = idx === activeSegIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveSegIdx(idx)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all
                      ${isActive
                        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    {label}
                    <span className={`ml-1.5 text-[10px] ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                      {seg.rounds.length}R
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 활성 세그먼트 콘텐츠 */}
          {activeSeg && (
            <SegmentContent
              seg={activeSeg}
              playerIds={playerIds}
              nicknames={nicknames}
            />
          )}
        </div>
      )}
    </div>
  );
}
