/**
 * 익명물약(anonymity) 적용 시 닉네임 마스킹 헬퍼.
 *
 *  - 본인 시점: 항상 원본 닉네임 표시
 *  - 다른 사람 시점(상대/관전자/로비): '???' 로 마스킹
 *  - 익명 처리된 player 의 displayedTitle 도 함께 숨김 (칭호로 정체 식별 방지)
 */

import type { Player, Room } from '@shared/types/room.js';
import type { ChatMessage } from '@shared/types/events.js';
import { isTokenAnonymized, getRoomShopState } from './roomShopState.js';

export const ANONYMOUS_NICKNAME = '???';

function maskPlayer(p: Player): Player {
  return {
    ...p,
    nickname: ANONYMOUS_NICKNAME,
    displayedTitle: null,
    // memberId 도 가린다 (신고/통계 식별 방지) — 단, 자기 자신 시점에서는 원본 사용.
    memberId: null,
  };
}

/**
 * Room 객체를 viewer 시점에서 마스킹.
 *  - viewerToken === null 또는 빈 문자열이면 "익명 외부인" 시점 (모두 마스킹)
 */
export function maskRoomForViewer(room: Room, viewerToken: string | null): Room {
  const state = getRoomShopState(room.id);
  if (!state || state.anonymizedTokens.size === 0) return room;

  const anon = state.anonymizedTokens;
  return {
    ...room,
    players: room.players.map((p) => {
      if (!anon.has(p.id)) return p;
      if (p.id === viewerToken) return p;
      return maskPlayer(p);
    }),
    spectators: room.spectators.map((p) => {
      if (!anon.has(p.id)) return p;
      if (p.id === viewerToken) return p;
      return maskPlayer(p);
    }),
  };
}

/**
 * chat:message 에 적용.
 *  - msg.sender 는 socket.id 일 수 있어 token 매칭이 어렵다.
 *    senderMemberId 로 익명 대상인지 판정하고,
 *    viewerMemberId 가 같으면 본인 시점으로 보고 마스킹 하지 않는다.
 */
export function maskChatMessageForViewer(
  roomId: string,
  msg: ChatMessage,
  viewerMemberId: string | null,
): ChatMessage {
  const state = getRoomShopState(roomId);
  if (!state || state.anonymizedMemberIds.size === 0) return msg;
  if (!msg.senderMemberId) return msg;
  if (!state.anonymizedMemberIds.has(msg.senderMemberId)) return msg;
  if (viewerMemberId && msg.senderMemberId === viewerMemberId) return msg;
  return {
    ...msg,
    senderNickname: ANONYMOUS_NICKNAME,
    senderTitle: null,
    senderGuildMark: null,
    senderMemberId: null,
  };
}

/**
 * GameResult.rankings / participants 의 닉네임도 마스킹.
 *  - 본인 시점이 아니면 익명 처리된 token 의 nickname → '???'
 *  - memberId 도 null 처리 (신고/통계 식별 방지)
 */
export function maskRankingForViewer<T extends { playerId: string; nickname: string; memberId?: string | null }>(
  roomId: string,
  rankings: T[],
  viewerToken: string | null,
): T[] {
  const state = getRoomShopState(roomId);
  if (!state || state.anonymizedTokens.size === 0) return rankings;
  return rankings.map((r) => {
    if (!state.anonymizedTokens.has(r.playerId)) return r;
    if (r.playerId === viewerToken) return r;
    return { ...r, nickname: ANONYMOUS_NICKNAME, memberId: null };
  });
}

/**
 * gameResultData.players[token].nickname 및 finishReason 문자열 마스킹.
 *  - viewerToken: 본인 토큰 (본인은 마스킹하지 않음)
 *  - anonNicknames: viewer 기준으로 마스킹해야 할 실제 닉네임 목록
 *    (호출자가 room.players에서 필터링해 전달)
 *  - gameResultData 구조가 없으면 원본 반환.
 */
export function maskGameResultDataForViewer(
  roomId: string,
  gameResultData: unknown,
  viewerToken?: string | null,
  anonNicknames?: string[],
): unknown {
  if (!gameResultData || typeof gameResultData !== 'object') return gameResultData;
  const data = gameResultData as Record<string, unknown>;
  const state = getRoomShopState(roomId);
  if (!state || state.anonymizedTokens.size === 0) return gameResultData;

  let result: Record<string, unknown> = data;

  // players[token].nickname 마스킹 (token 키 구조인 경우)
  if (data.players && typeof data.players === 'object') {
    const players = data.players as Record<string, unknown>;
    const maskedPlayers: Record<string, unknown> = {};
    for (const [token, playerData] of Object.entries(players)) {
      if (
        !playerData
        || typeof playerData !== 'object'
        || !state.anonymizedTokens.has(token)
        || token === viewerToken
      ) {
        maskedPlayers[token] = playerData;
        continue;
      }
      maskedPlayers[token] = { ...(playerData as Record<string, unknown>), nickname: ANONYMOUS_NICKNAME };
    }
    result = { ...result, players: maskedPlayers };
  }

  // finishReason 문자열 내 실명 마스킹
  if (anonNicknames && anonNicknames.length > 0 && typeof data.finishReason === 'string') {
    let reason = data.finishReason as string;
    for (const nick of anonNicknames) {
      reason = reason.replaceAll(nick, ANONYMOUS_NICKNAME);
    }
    if (reason !== data.finishReason) {
      result = { ...result, finishReason: reason };
    }
  }

  return result === data ? gameResultData : result;
}
