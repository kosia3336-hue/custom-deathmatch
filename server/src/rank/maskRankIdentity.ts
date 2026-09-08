/**
 * 랭크 매치 신원 가림 (익명 물약과 별도).
 *
 * 물약(`maskNicknames.ts`)은 수정하지 않는다. 적용 순서는 물약 → 랭크.
 * 랭크는 플레이어끼리만 상대 닉을 '???' 로 바꾼다. 칭호·길드·memberId 는 유지.
 * 관전자·결과·전적은 이 레이어를 타지 않는다.
 */

import type { ChatMessage } from '@shared/types/events.js';
import type { Room } from '@shared/types/room.js';
import { ANONYMOUS_NICKNAME, maskRoomForViewer } from '../shop/maskNicknames.js';
import { isTokenAnonymized } from '../shop/roomShopState.js';
import { roomStore } from '../store/rooms.js';

export function rankedRoomTitle(gameName: string): string {
  return `[랭크] ${gameName}`;
}

function isRoomPlayer(room: Room, id: string | null | undefined): boolean {
  if (!id) return false;
  return room.players.some((p) => p.id === id);
}

/**
 * 인게임 HUD·채팅·room:state 용 닉.
 *  1. 본인 → 실명
 *  2. 익명 물약 → ???
 *  3. 랭크 + 양쪽 플레이어 → ???
 *  4. 관전자(토큰 있음)가 플레이어를 볼 때 → 실명
 *  5. viewer 미상(broadcast 폴백) + 랭크 플레이어 → ???
 */
export function nicknameForViewer(
  roomId: string,
  targetId: string,
  nickname: string,
  viewerId: string | null,
): string {
  if (targetId === viewerId) return nickname;
  if (isTokenAnonymized(roomId, targetId)) return ANONYMOUS_NICKNAME;

  const room = roomStore.get(roomId);
  if (!room?.isRanked) return nickname;
  if (!isRoomPlayer(room, targetId)) return nickname;
  if (isRoomPlayer(room, viewerId)) return ANONYMOUS_NICKNAME;
  if (viewerId) return nickname;
  return ANONYMOUS_NICKNAME;
}

/** 랭크: 플레이어 viewer 에게만 상대 플레이어 닉을 ???. 칭호·memberId 유지. */
export function maskRankRoomForViewer(room: Room, viewerToken: string | null): Room {
  if (!room.isRanked) return room;
  if (!isRoomPlayer(room, viewerToken)) return room;
  return {
    ...room,
    players: room.players.map((p) =>
      p.id === viewerToken ? p : { ...p, nickname: ANONYMOUS_NICKNAME },
    ),
  };
}

/** 물약 후 랭크. rooms.ts 는 이 파일을 import 하지 말 것(순환). */
export function applyViewerRoomMask(room: Room, viewerToken: string | null): Room {
  return maskRankRoomForViewer(maskRoomForViewer(room, viewerToken), viewerToken);
}

/**
 * 랭크 방 채팅: 상대 플레이어에게 닉만 ???.
 * 칭호·길드·senderMemberId 유지. 관전자 발신/수신·시스템은 실명.
 */
export function maskRankChatForViewer(
  room: Room,
  msg: ChatMessage,
  viewerToken: string | null,
): ChatMessage {
  if (!room.isRanked) return msg;
  if (msg.isSystem) return msg;
  if (msg.isSpectator) return msg;
  if (!isRoomPlayer(room, viewerToken)) return msg;

  const viewer = room.players.find((p) => p.id === viewerToken);
  if (viewer?.memberId && msg.senderMemberId && viewer.memberId === msg.senderMemberId) {
    return msg;
  }

  const senderIsPlayer = msg.senderMemberId
    ? room.players.some((p) => p.memberId === msg.senderMemberId)
    : false;
  if (!senderIsPlayer) return msg;

  return { ...msg, senderNickname: ANONYMOUS_NICKNAME };
}
