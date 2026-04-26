'use client';

import { useState } from 'react';
import type { GameRecordFile, SunMoonStar2ArchiveRecord } from '@/shared/types/archive';
import type {
  SMS2MarkId,
  SMS2RoundRecord,
  SMS2Side,
} from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, sumBet, sumPowder } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES, WIN_TYPE_LABELS } from '@/components/game/modules/sun-moon-star-2/constants';
import { formatTime } from '@/lib/utils';

interface Props {
  record: GameRecordFile;
}

export default function SunMoonStar2Viewer({ record }: Props) {
  const gameRecord = record.gameRecord as SunMoonStar2ArchiveRecord;
  const sides = gameRecord.sides;
  const rounds = gameRecord.rounds ?? [];

  const nicknames: Record<SMS2Side, string> = {
    p1: gameRecord.players?.[sides.p1]?.nickname ?? record.players?.[sides.p1]?.nickname ?? 'P1',
    p2: gameRecord.players?.[sides.p2]?.nickname ?? record.players?.[sides.p2]?.nickname ?? 'P2',
  };

  const winnerSide: SMS2Side | null =
    gameRecord.winnerId && sides.p1 === gameRecord.winnerId ? 'p1'
    : gameRecord.winnerId && sides.p2 === gameRecord.winnerId ? 'p2'
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
              <span className="text-xs text-gray-500 lg:text-sm">
                {winTypeLabel}
                {gameRecord.suddenDeath ? ' · 서든데스 진행' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-8 lg:gap-12">
            {(['p1', 'p2'] as const).map((side) => {
              const isWinner = winnerSide === side;
              return (
                <div key={side} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 lg:text-sm">
                    {nicknames[side]}
                  </span>
                  <span className={`text-2xl font-bold tabular-nums lg:text-4xl ${isWinner ? 'text-emerald-600' : 'text-gray-700'}`}>
                    {gameRecord.finalChips[sides[side]] ?? 0}
                  </span>
                  <span className="text-[10px] text-gray-400 lg:text-xs">칩</span>
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
            rounds.map((r, idx) => (
              <RoundRow
                key={`${r.round}-${r.firstPlayerSide}`}
                record={r}
                prevStageBefore={idx > 0 ? rounds[idx - 1].stageAfter : { p1: 5, p2: 5 }}
                nicknames={nicknames}
                expanded={expandedRound === r.round}
                onToggle={() => setExpandedRound(expandedRound === r.round ? null : r.round)}
                isSuddenDeath={gameRecord.suddenDeath && r.round === rounds.length}
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
            <span className="font-medium text-gray-800">{formatTime(record.result.playTime)}</span>
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
  prevStageBefore,
  nicknames,
  expanded,
  onToggle,
  isSuddenDeath,
}: {
  record: SMS2RoundRecord;
  prevStageBefore: { p1: SMS2PowderStage; p2: SMS2PowderStage };
  nicknames: Record<SMS2Side, string>;
  expanded: boolean;
  onToggle: () => void;
  isSuddenDeath: boolean;
}) {
  const s = MARK_STYLES[record.litMark];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left transition-colors hover:bg-white lg:px-4 lg:py-3"
      >
        {/* 1행: 라운드 번호 + 점등 표식 + 선 플레이어 + 토글 */}
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="shrink-0 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-600 lg:px-2.5 lg:text-sm">
            R{record.round}
          </span>
          {isSuddenDeath && (
            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white lg:text-[11px]">
              SD
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold lg:px-2 lg:text-xs ${s.bgSoft} ${s.textSoft}`}>
            {s.icon} {s.label} 점등
          </span>
          <span className="text-[10px] text-gray-400 lg:text-xs">
            선 {nicknames[record.firstPlayerSide]}
          </span>
          <span className="ml-auto shrink-0 text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>

        {/* 2행: 양측 칩 변화 */}
        <div className="mt-1.5 flex items-center gap-4 lg:mt-2 lg:gap-8">
          {(['p1', 'p2'] as const).map((side) => {
            const delta = record.chipDelta[side];
            const after = record.chipAfter[side];
            const deltaColor = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-gray-400';
            return (
              <span key={side} className="text-xs text-gray-600 lg:text-sm">
                {nicknames[side]}{' '}
                <b className={`tabular-nums ${deltaColor}`}>
                  {delta > 0 ? `+${delta}` : `${delta}`}
                </b>
                <span className="ml-0.5 text-[10px] text-gray-400 tabular-nums lg:text-xs">
                  (→{after})
                </span>
              </span>
            );
          })}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-3 lg:space-y-4 lg:p-4">
          {/* 빛가루 분배 */}
          <div className="space-y-1">
            {(['p1', 'p2'] as const).map((side) => {
              const powder = record.powderSubmission[side];
              const total = sumPowder(powder);
              return (
                <div key={side} className="flex items-center gap-2 text-[11px] text-gray-600 lg:gap-3 lg:text-sm">
      <span className="w-18 shrink-0 font-semibold text-gray-500 lg:w-40">
                    ✨ {nicknames[side]}
                  </span>
                  <span className="tabular-nums text-gray-400">{total}g</span>
                  <span className="text-gray-300">—</span>
                  {MARK_IDS.map((m) => (
                    <span key={m} className="tabular-nums">
                      {MARK_STYLES[m].icon}{powder[m]}g
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 단계 변화 */}
          <div className="flex items-center gap-2 text-[11px] lg:gap-3 lg:text-sm">
            <span className="shrink-0 text-gray-400">단계 변화</span>
            {(['p1', 'p2'] as const).map((side, i) => {
              const diff = prevStageBefore[side] - record.stageAfter[side];
              return (
                <span key={side} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-300">/</span>}
                  <span className={`font-semibold tabular-nums ${diff > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {nicknames[side]} {diff > 0 ? `${diff}칸↓` : '유지'}
                  </span>
                </span>
              );
            })}
          </div>

          {/* 베팅 */}
          <div className="space-y-1">
            {(['p1', 'p2'] as const).map((side) => (
              <BetRow
                key={side}
                label={nicknames[side]}
                bet={record.bets[side]}
                delta={record.chipDelta[side]}
                after={record.chipAfter[side]}
                litMark={record.litMark}
                isFirst={side === record.firstPlayerSide}
              />
            ))}
          </div>

          {/* 자동 제출 알림 */}
          {(record.auto.p1 || record.auto.p2) && (
            <p className="text-[11px] text-amber-700 lg:text-sm">
              ⚠️ 자동 제출:
              {record.auto.p1 && ` ${nicknames.p1}`}
              {record.auto.p2 && ` ${nicknames.p2}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════ BetRow ════════════ */

function BetRow({
  label,
  bet,
  delta,
  after,
  litMark,
  isFirst,
}: {
  label: string;
  bet: { sun: number; moon: number; star: number };
  delta: number;
  after: number;
  litMark: SMS2MarkId;
  isFirst: boolean;
}) {
  const total = sumBet(bet);
  const isPos = delta > 0;
  const isNeg = delta < 0;
  const deltaColor = isPos ? 'text-emerald-600' : isNeg ? 'text-rose-600' : 'text-gray-400';

  return (
    <div className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-[11px] lg:gap-3 lg:px-3 lg:py-2 lg:text-sm">
      <span className="w-18 shrink-0 font-bold text-gray-700 lg:w-40">
        {label}
        {isFirst && <span className="ml-1 text-amber-500">👑</span>}
      </span>
      <div className="flex shrink-0 items-center gap-0.5 lg:gap-1">
        {MARK_IDS.map((m) => {
          const ms = MARK_STYLES[m];
          const v = bet[m];
          const isLit = m === litMark;
          return (
            <span
              key={m}
              className={`rounded px-1 py-0.5 tabular-nums font-semibold lg:px-1.5 ${
                v > 0
                  ? isLit
                    ? `${ms.chipSelf} ring-1 ${ms.ringLit}`
                    : ms.chipSelf
                  : 'text-gray-300'
              }`}
            >
              {ms.icon}{v}
            </span>
          );
        })}
      </div>
      <span className="text-gray-400 tabular-nums">{total}칩</span>
      <span className={`ml-auto shrink-0 font-bold tabular-nums ${deltaColor}`}>
        {isPos ? `+${delta}` : `${delta}`}
        <span className="ml-0.5 font-normal text-gray-400">({after})</span>
      </span>
    </div>
  );
}

/* ════════════ 타입 ════════════ */

type SMS2PowderStage = 1 | 2 | 3 | 4 | 5;
