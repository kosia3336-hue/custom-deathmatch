/**
 * 마이페이지 전적 화면에서 상대 이름을 익명 물약 규칙에 맞게 고른다.
 *
 * 익명 물약은 랭크 매치에서만 쓰이고, 그 판의 참가자 스냅샷
 * (`game_log_participants.anonymized`)에 남는다. 전적 화면이 상대의 *현재* 닉네임
 * (`members.nickname`)을 그대로 붙이면 물약을 쓴 판에서도 실명이 보인다.
 * 그래서 이름은 판마다 참가자 스냅샷에서 고르고, 물약 판이면 '???' 로 둔다.
 */

export const ANONYMOUS_NICKNAME = '???';

export interface MatchParticipantRow {
  game_log_id: string;
  member_id: string | null;
  nickname_snapshot: string;
  anonymized: boolean;
}

/**
 * 랭크 매치 한 판의 상대 표시명.
 * - 참가자 스냅샷이 있고 물약을 쓰지 않았으면 그때 닉네임.
 * - 물약 판이거나, 기록이 없어 물약 여부를 알 수 없으면 '???'
 *   (모를 때 실명을 보여 주면 물약이 새는 구멍이 된다).
 */
export function rankOpponentName(
  gameLogId: string | null,
  opponentId: string,
  participants: readonly MatchParticipantRow[],
): string {
  if (!gameLogId) return ANONYMOUS_NICKNAME;
  const row = participants.find((p) => p.game_log_id === gameLogId && p.member_id === opponentId);
  if (!row || row.anonymized) return ANONYMOUS_NICKNAME;
  return row.nickname_snapshot || ANONYMOUS_NICKNAME;
}

/**
 * '힘든 상대' 집계에서, 나와의 판에서 익명 물약을 쓴 적이 있는 상대를 뺀다.
 * 집계 숫자에 물약 판이 섞여 있으면 판이 끝난 뒤 숫자가 바뀐 상대로 누구였는지
 * 알아낼 수 있으므로, 이름만 가리지 않고 항목을 통째로 뺀다.
 *
 * `anonymizedRows` 는 나와 함께한 판의 참가자 중 anonymized=true 인 행
 * (RLS 가 내가 참가한 판의 참가자만 돌려준다).
 */
export function withoutAnonymizedOpponents<T extends { opponent_id: string }>(
  rows: readonly T[],
  anonymizedRows: readonly { member_id: string | null }[],
): T[] {
  const hidden = new Set(anonymizedRows.map((r) => r.member_id).filter(Boolean));
  return rows.filter((r) => !hidden.has(r.opponent_id));
}
