'use client';

import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { TurnBadge } from '@/components/cdm/TurnBadge';
import { Card } from '@/components/cdm/Card';
import LogViewer from '@/components/archive/LogViewer';
import { formatTime } from '@/lib/utils';
import type { FourGravityRecord, GameRecordFile } from '@/shared/types/archive';
import { GAME_IDS } from '@/shared/types/game';
import { PLAY_MODE_LABEL, type PlayMode } from '@/shared/types/room';
import type { TitleColor } from '@/lib/supabase/database.types';

export interface GameLogPlayer {
  nickname: string;
  title?: { name: string; color: TitleColor; effect?: string | null } | null;
  turn: 'first' | 'second';
  isWinner: boolean;
  isDraw: boolean;
  isDoubleLoss?: boolean;
  isResign: boolean;
}

export interface GameLogMeta {
  gameId: string;
  gameName: string;
  playedAt: string;
  playTimeMs: number;
  totalTurns: number;
  mode: PlayMode;
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

function withRecordedFourGravityOrder(
  players: GameLogPlayer[],
  record: GameRecordFile | null,
): GameLogPlayer[] {
  if (record?.gameId !== GAME_IDS.FOUR_GRAVITY) return players;

  const gameRecord = record.gameRecord as FourGravityRecord | null;
  const blackNickname =
    gameRecord?.players?.black?.nickname ??
    gameRecord?.actions?.find((action) => action.color === 'black')?.nickname;
  const whiteNickname =
    gameRecord?.players?.white?.nickname ??
    gameRecord?.actions?.find((action) => action.color === 'white')?.nickname;
  if (!blackNickname || !whiteNickname || blackNickname === whiteNickname) return players;

  const blackPlayer = players.find((player) => player.nickname === blackNickname);
  const whitePlayer = players.find((player) => player.nickname === whiteNickname);
  if (!blackPlayer || !whitePlayer || blackPlayer === whitePlayer) return players;

  return players.map((player) => {
    if (player === blackPlayer) return { ...player, turn: 'first' };
    if (player === whitePlayer) return { ...player, turn: 'second' };
    return player;
  });
}

export default function GameLogView({
  players,
  meta,
  record,
  viewingAs = 'self',
  selfNickname,
}: Props) {
  const orderedPlayers = withRecordedFourGravityOrder(players, record);
  const first = orderedPlayers.find((p) => p.turn === 'first');
  const second = orderedPlayers.find((p) => p.turn === 'second');

  const isDoubleLoss = orderedPlayers.some((p) => p.isDoubleLoss === true);
  const isDraw =
    !isDoubleLoss
    && (orderedPlayers.every((p) => p.isDraw) || orderedPlayers.some((p) => p.isDraw));
  const winner = !isDraw && !isDoubleLoss ? orderedPlayers.find((p) => p.isWinner) : null;

  const resultLabel = meta.mode === 'tutorial'
    ? '튜토리얼 완료'
    : isDoubleLoss
      ? '양쪽 패배'
      : isDraw
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
                {PLAY_MODE_LABEL[meta.mode]}
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
              isDoubleLoss={isDoubleLoss}
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
              isDoubleLoss={isDoubleLoss}
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
          <p className="text-sm text-cdm-fg-muted">이 게임의 로그 뷰어가 아직 준비되지 않았습니다.</p>
        )}
      </Card>
    </div>
  );
}

function PlayerCard({
  player,
  align,
  isDraw,
  isDoubleLoss,
  isSelf,
}: {
  player: GameLogPlayer;
  align: 'left' | 'right';
  isDraw: boolean;
  isDoubleLoss: boolean;
  isSelf: boolean;
}) {
  const resultLabel = player.isResign
    ? '기권'
    : isDoubleLoss
      ? '패배'
      : isDraw
        ? '무승부'
        : player.isWinner
          ? '승리'
          : '패배';

  const resultColor = player.isResign || isDoubleLoss || (!isDraw && !player.isWinner)
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
          <TitleBadge
            name={player.title.name}
            color={player.title.color}
            effect={(player.title.effect as TitleEffect | null) ?? null}
            size="sm"
          />
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
