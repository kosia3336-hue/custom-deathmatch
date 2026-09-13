/**
 * 결과 공유 페이지·카드 이미지에 보여 줄 값을 게임 로그 행에서 만든다(순수 함수).
 *
 * 보이는 것: 게임명, 공유한 사람 입장의 승패, 공유한 사람·상대 닉네임, 일시, 플레이 시간, 턴 수,
 * 랭크전 여부. 수순·패·회원 id 는 싣지 않는다. 상대가 익명 물약을 쓴 판이면 상대는 '???'.
 * 공유한 사람 자신의 닉네임은 본인이 공유를 골랐으므로 그대로 보인다.
 */

import { ANONYMOUS_NICKNAME } from '../anonymousOpponents';
import { formatShareDateTime } from '../resultShare';
import type { SharePosition } from './resultToken';

export interface ShareLogRow {
  id: string;
  game_id: string;
  played_at: string;
  play_time_seconds: number;
  total_turns: number;
  room_snapshot: { gameName?: string; title?: string } | null;
}

export interface ShareParticipantRow {
  position: SharePosition;
  member_id: string | null;
  nickname_snapshot: string;
  anonymized: boolean;
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
}

export type ShareResultKind = 'win' | 'lose' | 'draw' | 'resign';

export const SHARE_RESULT_LABEL: Record<ShareResultKind, string> = {
  win: '승리',
  lose: '패배',
  draw: '무승부',
  resign: '기권',
};

export interface ResultShareView {
  gameId: string;
  gameName: string;
  result: ShareResultKind;
  resultLabel: string;
  sharerNickname: string;
  opponents: string[];
  playedAt: string;
  playTimeMs: number;
  totalTurns: number;
  isRanked: boolean;
}

export function buildResultShareView(
  log: ShareLogRow,
  participants: readonly ShareParticipantRow[],
  position: SharePosition,
  opts: { gameName?: string; isRanked: boolean },
): ResultShareView | null {
  const me = participants.find((p) => p.position === position);
  if (!me) return null;

  const result: ShareResultKind = me.is_draw
    ? 'draw'
    : me.is_winner === true
      ? 'win'
      : me.is_resign
        ? 'resign'
        : 'lose';

  return {
    gameId: log.game_id,
    gameName: opts.gameName ?? log.room_snapshot?.gameName ?? log.game_id,
    result,
    resultLabel: SHARE_RESULT_LABEL[result],
    sharerNickname: me.nickname_snapshot || '플레이어',
    opponents: participants
      .filter((p) => p !== me)
      .map((p) => (p.anonymized ? ANONYMOUS_NICKNAME : p.nickname_snapshot || '탈퇴 회원')),
    playedAt: log.played_at,
    playTimeMs: Math.max(0, log.play_time_seconds) * 1000,
    totalTurns: Math.max(0, log.total_turns),
    isRanked: opts.isRanked,
  };
}

/** 상대 이름 목록 — 많으면 앞 두 명 + '외 n명' */
export function formatShareOpponents(names: readonly string[], max = 2): string {
  const shown = names.slice(0, max).join(', ');
  const rest = names.length - max;
  return rest > 0 ? `${shown} 외 ${rest}명` : shown;
}

export function formatSharePlayTime(playTimeMs: number): string {
  const seconds = Math.max(0, Math.floor(playTimeMs / 1000));
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

/** 미리보기 설명 한 줄: 승리 vs 샤인 · 2026.09.13 23:43 · 플레이 3분 2초 · 18턴 */
export function describeResultShare(view: ResultShareView): string {
  return [
    `${view.resultLabel}${view.opponents.length ? ` vs ${formatShareOpponents(view.opponents)}` : ''}`,
    formatShareDateTime(view.playedAt),
    `플레이 ${formatSharePlayTime(view.playTimeMs)}`,
    `${view.totalTurns}턴`,
  ]
    .filter(Boolean)
    .join(' · ');
}
