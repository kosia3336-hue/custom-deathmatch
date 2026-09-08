import type { IO } from './types.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { applyViewerRoomMask, nicknameForViewer } from '../rank/maskRankIdentity.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import type { Room } from '@shared/types/room.js';
import type { TypedSocket } from './types.js';

export function socketRoom(roomId: string): string {
  return `room:${roomId}`;
}

export function guildRoom(guildId: string): string {
  return `guild:${guildId}`;
}

function roomNeedsPerSocketMask(room: Room): boolean {
  if (room.isRanked) return true;
  return (getRoomShopState(room.id)?.anonymizedTokens.size ?? 0) > 0;
}

/** viewer 시점에 마스킹된 ClientRoom. 마스킹 효과가 없으면 원본 그대로. */
export function maskedClientRoomFor(roomId: string, viewerToken: string | null): Room | undefined {
  const room = roomStore.getClientRoom(roomId);
  if (!room) return undefined;
  if (!roomNeedsPerSocketMask(room)) return room;
  return applyViewerRoomMask(room, viewerToken);
}

/** 위 헬퍼의 socket 편의판. */
export function maskedClientRoomForSocket(roomId: string, socket: TypedSocket): Room | undefined {
  return maskedClientRoomFor(roomId, sessions.getToken(socket.id) ?? null);
}

/**
 * 룸 안의 모든 소켓에게 viewer 시점 마스킹된 room:state 를 emit.
 *  - 익명 효과·랭크가 없으면 한 번에 broadcast
 *  - 있으면 소켓별로 개별 emit (플레이어 vs 관전자가 다름)
 */
export function emitRoomStateToRoom(io: IO, roomId: string): void {
  const room = roomStore.getClientRoom(roomId);
  if (!room) return;

  if (!roomNeedsPerSocketMask(room)) {
    io.to(socketRoom(roomId)).emit('room:state', room);
    return;
  }

  const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
  if (!sockets || sockets.size === 0) return;
  for (const sid of sockets) {
    const token = sessions.getToken(sid) ?? null;
    io.sockets.sockets.get(sid)?.emit('room:state', applyViewerRoomMask(room, token));
  }
}

/** 재연결·퇴장 토스트처럼 닉 하나가 viewer 별로 달라질 때. */
export function emitToRoomWithViewerNickname(
  io: IO,
  roomId: string,
  event: 'player:reconnected' | 'player:reconnecting' | 'room:player:left',
  payload: { playerId: string; secondsLeft?: number; newHostId?: string },
  realNickname: string,
  excludeSocketId?: string,
): void {
  const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
  if (!sockets || sockets.size === 0) return;
  for (const sid of sockets) {
    if (excludeSocketId && sid === excludeSocketId) continue;
    const viewerId = sessions.getToken(sid) ?? null;
    const nickname = nicknameForViewer(roomId, payload.playerId, realNickname, viewerId);
    io.sockets.sockets.get(sid)?.emit(event, { ...payload, nickname });
  }
}
