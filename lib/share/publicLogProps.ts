/**
 * 공개 기보(결과 공유 링크) 화면에 넘길 GameLogView props — 순수 함수.
 *
 * 참가자 전용 로그 페이지(app/me/log/[logId])와 같은 기록을 보여 주되, 누가 열든 같은 화면이다.
 * - 익명 물약을 쓴 참가자는 공유한 사람 본인이 아니면 **항상** '???'.
 *   닉네임·칭호뿐 아니라 순위와 기록 본문(game_record) 속 이름까지 가린다.
 * - 회원 id 는 싣지 않는다(record.players 키는 자리 이름).
 */

import { ANONYMOUS_NICKNAME } from '../anonymousOpponents';
import { maskGameRecordNicknames } from '../maskGameRecord';
import type { GameLogMeta, GameLogPlayer } from '@/components/game/GameLogView';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { GameRecordFile } from '@/shared/types/archive';
import type { PlayMode } from '@/shared/types/room';
import type { SharePosition } from './resultToken';
import type { ShareParticipantRow } from './resultShareView';

export interface PublicLogRow {
  id: string;
  game_id: string;
  mode: PlayMode;
  played_at: string;
  play_time_seconds: number;
  total_turns: number;
  counts_for_stats: boolean;
  game_record: unknown;
  room_snapshot: { gameName?: string; playMode?: string; title?: string } | null;
}

export interface PublicParticipantRow extends ShareParticipantRow {
  title_snapshot: { id: string; name: string; color: TitleColor } | null;
}

export interface PublicLogProps {
  players: GameLogPlayer[];
  meta: GameLogMeta;
  record: GameRecordFile;
}

export function buildPublicLogProps(
  log: PublicLogRow,
  participants: readonly PublicParticipantRow[],
  sharerPosition: SharePosition,
  gameName: string,
): PublicLogProps {
  const isMasked = (p: PublicParticipantRow) => p.anonymized && p.position !== sharerPosition;
  const nameOf = (p: PublicParticipantRow) => (isMasked(p) ? ANONYMOUS_NICKNAME : p.nickname_snapshot);
  const hiddenNicknames = participants
    .filter(isMasked)
    .map((p) => p.nickname_snapshot)
    .filter(Boolean);

  const players: GameLogPlayer[] = participants.map((p) => ({
    nickname: nameOf(p),
    title: isMasked(p) ? null : p.title_snapshot,
    turn: p.position,
    isWinner: p.is_winner === true,
    isDraw: p.is_draw,
    isResign: p.is_resign,
  }));

  const meta: GameLogMeta = {
    gameId: log.game_id,
    gameName,
    playedAt: log.played_at,
    playTimeMs: log.play_time_seconds * 1000,
    totalTurns: log.total_turns,
    mode: log.mode,
    countsForStats: log.counts_for_stats,
  };

  const record: GameRecordFile = {
    version: '2',
    gameId: log.game_id,
    gameName,
    playedAt: log.played_at,
    playMode: (log.room_snapshot?.playMode ?? log.mode) as PlayMode,
    players: Object.fromEntries(participants.map((p) => [p.position, { nickname: nameOf(p) }])),
    result: {
      rankings: participants.map((p) => ({
        nickname: nameOf(p),
        rank: p.is_winner || p.is_draw ? 1 : 2,
        score: 0,
      })),
      playTime: log.play_time_seconds * 1000,
      totalTurns: log.total_turns,
    },
    gameRecord: maskGameRecordNicknames(log.game_record, hiddenNicknames),
  };

  return { players, meta, record };
}
