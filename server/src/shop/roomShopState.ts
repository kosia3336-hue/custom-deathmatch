/**
 * 룸별 상점 효과 상태 (익명물약 / 관전 잠금 / 플레이어 bias 칭호).
 *
 *  - 게임 시작 시 applyAutoConsumables 가 채워주고,
 *  - 게임/방 종료 시 cleanupRoomShopState() 로 삭제.
 *
 *  RAM only — 재시작 시 사라져도 무방. 사용 이력은 DB shop_consumable_uses 가 SoT.
 */

export interface RoomShopState {
  /** 관전이 잠긴 회원의 token Set (해당 토큰 = playerId) */
  spectatorLockedTokens: Set<string>;
  /** 익명화된 회원의 token Set */
  anonymizedTokens: Set<string>;
  /** 익명화된 회원의 memberId Set (chat senderMemberId 매칭용) */
  anonymizedMemberIds: Set<string>;
  /**
   * 플레이어별 활성 bias 칭호 ID Set.
   *  key = player token (Player.id)
   *  value = Set<titleId>
   */
  biasTitlesByToken: Map<string, Set<string>>;
}

const states = new Map<string, RoomShopState>();

export function ensureRoomShopState(roomId: string): RoomShopState {
  let s = states.get(roomId);
  if (!s) {
    s = {
      spectatorLockedTokens: new Set(),
      anonymizedTokens: new Set(),
      anonymizedMemberIds: new Set(),
      biasTitlesByToken: new Map(),
    };
    states.set(roomId, s);
  }
  return s;
}

export function getRoomShopState(roomId: string): RoomShopState | undefined {
  return states.get(roomId);
}

export function isRoomSpectatorLocked(roomId: string): boolean {
  return (states.get(roomId)?.spectatorLockedTokens.size ?? 0) > 0;
}

export function isTokenAnonymized(roomId: string, token: string): boolean {
  return states.get(roomId)?.anonymizedTokens.has(token) === true;
}

export function getBiasTitlesByToken(roomId: string, token: string): ReadonlySet<string> {
  return states.get(roomId)?.biasTitlesByToken.get(token) ?? new Set();
}

export function cleanupRoomShopState(roomId: string): void {
  states.delete(roomId);
}
