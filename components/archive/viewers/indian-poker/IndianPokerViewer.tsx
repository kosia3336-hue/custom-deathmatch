'use client';

import { useState } from 'react';
import type { GameRecordFile, IndianPokerRecord, IndianPokerRoundRecord } from '@/shared/types/archive';
import { formatTime } from '@/lib/utils';

const HAND_LABEL: Record<string, string> = {
  noPair: '노페어',
  double: '더블',
  straight: '스트레이트',
  triple: '트리플',
};

const ACTION_LABEL: Record<string, string> = {
  check: '체크',
  call: '콜',
  raise: '레이즈',
  die: '다이',
};

const WIN_TYPE_LABEL: Record<string, string> = {
  chipOut: '상대 칩 소진',
  anteLack: '앤트 지불 불가',
  timeout: '시간 초과',
  leave: '상대 이탈',
};

interface Props {
  record: GameRecordFile;
}

function CardBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="inline-flex h-7 w-5 items-center justify-center rounded border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-300">?</span>;
  return <span className="inline-flex h-7 w-5 items-center justify-center rounded border border-gray-300 bg-white text-sm font-bold text-gray-900">{value}</span>;
}

function RoundRow({
  roundRecord,
  playerIds,
  nicknames,
  isLast,
}: {
  roundRecord: IndianPokerRoundRecord;
  playerIds: string[];
  nicknames: Record<string, string>;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(isLast);

  const isDraw = roundRecord.isDraw;
  const isDie = roundRecord.isDie;
  const winnerId = roundRecord.winnerId;

  return (
    <div className={`rounded-lg border text-sm ${isLast ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
      {/* 헤더 */}
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-500">R{roundRecord.round}</span>
          {/* 공유카드 */}
          <div className="flex items-center gap-1">
            <CardBadge value={roundRecord.communityCards[0]} />
            <CardBadge value={roundRecord.communityCards[1]} />
          </div>
          {/* 결과 레이블 */}
          {isDraw && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">무승부</span>}
          {isDie && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">다이</span>}
          {!isDraw && !isDie && winnerId && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              {nicknames[winnerId] ?? winnerId} 승
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {/* 상세 */}
      {open && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2">
          {/* 플레이어별 카드·족보·칩 */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            {playerIds.map((pid) => {
              const handVal = roundRecord.hands?.[pid];
              const handLabel = typeof handVal === 'string' ? handVal : (handVal as { hand: string } | undefined)?.hand;
              const card = roundRecord.playerCards?.[pid] ?? (typeof handVal === 'object' && handVal !== null ? (handVal as { card: number }).card : null);
              const chipChange = roundRecord.chipChanges?.[pid];
              const isWinner = pid === winnerId && !isDraw;
              return (
                <div
                  key={pid}
                  className={`flex flex-col gap-1 rounded-lg border p-2 ${isWinner ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}
                >
                  <span className="truncate font-medium text-gray-800">{nicknames[pid] ?? pid}</span>
                  <div className="flex items-center gap-2">
                    <CardBadge value={card ?? null} />
                    {handLabel && (
                      <span className="text-xs text-gray-600">{HAND_LABEL[handLabel] ?? handLabel}</span>
                    )}
                  </div>
                  {chipChange !== undefined && (
                    <span className={`text-xs font-bold ${chipChange > 0 ? 'text-emerald-600' : chipChange < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      {chipChange > 0 ? `+${chipChange}` : chipChange} 칩
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 베팅 액션 순서 */}
          {roundRecord.bettingActions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {roundRecord.bettingActions.map((a, i) => {
                const label = a.action === 'raise' && a.amount !== undefined
                  ? `레이즈(${a.amount})`
                  : (ACTION_LABEL[a.action] ?? a.action);
                const colorClass = a.action === 'die' ? 'bg-red-100 text-red-700'
                  : a.action === 'raise' ? 'bg-amber-100 text-amber-700'
                  : a.action === 'call' ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600';
                return (
                  <span key={i} className={`rounded px-1.5 py-0.5 text-xs ${colorClass}`}>
                    {nicknames[a.playerId] ?? a.playerId}: {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IndianPokerViewer({ record }: Props) {
  const gameRecord = record.gameRecord as IndianPokerRecord;
  const rounds = gameRecord.roundHistory ?? [];
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
      {/* 플레이어 칩 요약 */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        {playerIds.map((pid) => {
          const rank = record.result.rankings.find((r) => r.nickname === nicknames[pid]);
          return (
            <div key={pid} className="flex items-center gap-2">
              <span className="text-lg">{rank?.rank === 1 ? '🥇' : '🥈'}</span>
              <span className="font-bold text-gray-900">{nicknames[pid]}</span>
              <span className="text-sm text-gray-500">
                {gameRecord.finalChips?.[pid] !== undefined
                  ? `${gameRecord.finalChips[pid]} 칩`
                  : `${rank?.score ?? 0} 칩`}
              </span>
            </div>
          );
        })}
      </div>

      {/* 라운드 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="hidden border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 lg:block">
          라운드 기록 ({rounds.length}라운드)
        </div>
        <button
          className="flex w-full items-center justify-between border-b border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          라운드 기록 ({rounds.length}라운드)
          <span className="text-xs text-gray-400">{mobileOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        <div className={`space-y-2 p-3 ${!mobileOpen ? 'hidden lg:block' : ''}`}>
          {rounds.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">라운드 기록이 없습니다.</p>
          ) : (
            rounds.map((r, idx) => (
              <RoundRow
                key={r.round}
                roundRecord={r}
                playerIds={playerIds}
                nicknames={nicknames}
                isLast={idx === rounds.length - 1}
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
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? '1:COM' : '1:1 솔로'}
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
              {winnerNick ? `${winnerNick} 승` : '알 수 없음'}
              {gameRecord.winType ? ` (${WIN_TYPE_LABEL[gameRecord.winType] ?? gameRecord.winType})` : ''}
            </span>
          </span>
          <span>
            <span className="text-gray-400">시간</span>{' '}
            <span className="font-medium text-gray-800">{formatTime(record.result.playTime)}</span>
          </span>
          <span>
            <span className="text-gray-400">총 라운드</span>{' '}
            <span className="font-medium text-gray-800">{rounds.length}라운드</span>
          </span>
          {gameRecord.initialChips !== undefined && (
            <span>
              <span className="text-gray-400">시작 칩</span>{' '}
              <span className="font-medium text-gray-800">{gameRecord.initialChips}</span>
            </span>
          )}
          {gameRecord.deckCycles !== undefined && gameRecord.deckCycles > 1 && (
            <span>
              <span className="text-gray-400">덱 리셋</span>{' '}
              <span className="font-medium text-gray-800">{gameRecord.deckCycles - 1}회</span>
            </span>
          )}
          {gameRecord.finalAnte !== undefined && (
            <span>
              <span className="text-gray-400">최종 앤트</span>{' '}
              <span className="font-medium text-gray-800">{gameRecord.finalAnte}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
