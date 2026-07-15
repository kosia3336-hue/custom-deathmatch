'use client';

import { TitleBadge } from '@/components/cdm/TitleBadge';
import { TurnBadge } from '@/components/cdm/TurnBadge';
import { Card } from '@/components/cdm/Card';
import LogViewer from '@/components/archive/LogViewer';
import { formatTime } from '@/lib/utils';
import type { GameRecordFile } from '@/shared/types/archive';
import type { TitleColor } from '@/lib/supabase/database.types';

export interface GameLogPlayer {
  nickname: string;
  title?: { name: string; color: TitleColor } | null;
  turn: 'first' | 'second';
  isWinner: boolean;
  isDraw: boolean;
  isResign: boolean;
}

export interface GameLogMeta {
  gameId: string;
  gameName: string;
  playedAt: string;
  playTimeMs: number;
  totalTurns: number;
  mode: 'multi' | 'com' | 'solo';
  countsForStats: boolean;
}

interface Props {
  players: GameLogPlayer[];
  meta: GameLogMeta;
  record: GameRecordFile | null;
  /** 'self': 본인 참가자 기준 ("나" 표시). 'admin': 양측 닉네임 그대로 */
  viewingAs?: 'self' | 'admin';
  /** viewingAs='self' 일 때 본인 식별용 닉네임 */
  selfNickname?: string;
}

export default function GameLogView({
  players,
  meta,
  record,
  viewingAs = 'self',
  selfNickname,
}: Props) {
  const first = players.find((p) => p.turn === 'first');
  const second = players.find((p) => p.turn === 'second');

  const isDraw = players.every((p) => p.isDraw) || players.some((p) => p.isDraw);
  const winner = !isDraw ? players.find((p) => p.isWinner) : null;

  const resultLabel = isDraw
    ? '무승부'
    : winner
      ? `${winner.nickname} 승리`
      : '게임 종료';

  const accent = isDraw ? 'highlight' : winner ? 'accent' : 'primary';

  return (
    <div className="flex flex-col gap-6">
      {/* 결과 헤더 */}
      <Card variant="highlight" accent={accent as 'highlight' | 'accent' | 'primary'}>
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-cdm-fg sm:text-xl">{resultLabel}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-cdm-fg-muted">
            <span>{meta.gameName}</span>
            {meta.mode !== 'multi' && (
              <span className="rounded bg-cdm-bg-elev-2 px-1.5 py-0.5">
                {meta.mode === 'com' ? 'COM' : '솔로'}
              </span>
            )}
            {!meta.countsForStats && (
              <span className="text-cdm-fg-subtle">* 통계 미반영</span>
            )}
          </div>
        </header>

        {/* 플레이어 vs */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          {first && (
            <PlayerCard
              player={first}
              align="left"
              isDraw={isDraw}
              isSelf={viewingAs === 'self' && first.nickname === selfNickname}
            />
          )}
          {first && second && (
            <div className="hidden text-center text-xs font-bold text-cdm-fg-subtle sm:block">
              vs
            </div>
          )}
          {second && (
            <PlayerCard
              player={second}
              align="right"
              isDraw={isDraw}
              isSelf={viewingAs === 'self' && second.nickname === selfNickname}
            />
          )}
        </div>

        {/* 메타 */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-cdm-border pt-3 text-xs text-cdm-fg-muted">
          <span>{new Date(meta.playedAt).toLocaleString('ko-KR')}</span>
          <span>플레이 시간: {formatTime(meta.playTimeMs)}</span>
          <span>총 {meta.totalTurns}턴</span>
        </div>
      </Card>

      {/* 게임별 아카이브 뷰어 */}
      <Card>
        {record ? (
          <LogViewer record={record} />
        ) : (
          <p className="text-sm text-cdm-fg-muted">이 게임의 로그 뷰어가 아직 준비되지 않았어요.</p>
        )}
      </Card>
    </div>
  );
}

function PlayerCard({
  player,
  align,
  isDraw,
  isSelf,
}: {
  player: GameLogPlayer;
  align: 'left' | 'right';
  isDraw: boolean;
  isSelf: boolean;
}) {
  const resultLabel = player.isResign
    ? '기권'
    : isDraw
      ? '무승부'
      : player.isWinner
        ? '승리'
        : '패배';

  const resultColor = player.isResign || (!isDraw && !player.isWinner)
    ? 'text-cdm-fg-muted'
    : isDraw
      ? 'text-cdm-highlight'
      : 'text-cdm-accent';

  return (
    <div
      className={
        align === 'right'
          ? 'flex flex-col items-end gap-1 text-right'
          : 'flex flex-col items-start gap-1'
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {player.title && (
          <TitleBadge name={player.title.name} color={player.title.color} size="sm" />
        )}
        <span className="text-base font-bold text-cdm-fg">
          {player.nickname}
          {isSelf && <span className="ml-1 text-xs font-normal text-cdm-fg-muted">(나)</span>}
        </span>
        <TurnBadge turn={player.turn} size="sm" />
      </div>
      <span className={`text-sm font-semibold ${resultColor}`}>{resultLabel}</span>
    </div>
  );
}
