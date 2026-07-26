import type { IO } from './types.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { maskRoomForViewer } from '../shop/maskNicknames.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import type { Room } from '@shared/types/room.js';
import type { TypedSocket } from './types.js';

export function socketRoom(roomId: string): string {
  return `room:${roomId}`;
}

export function guildRoom(guildId: string): string {
  return `guild:${guildId}`;
}

/** viewer 시점에 마스킹된 ClientRoom. 마스킹 효과가 없으면 원본 그대로. */
export function maskedClientRoomFor(roomId: string, viewerToken: string | null): Room | undefined {
  const room = roomStore.getClientRoom(roomId);
  if (!room) return undefined;
  if (!getRoomShopState(roomId)?.anonymizedTokens.size) return room;
  return maskRoomForViewer(room, viewerToken);
}

/** 위 헬퍼의 socket 편의판. */
export function maskedClientRoomForSocket(roomId: string, socket: TypedSocket): Room | undefined {
  return maskedClientRoomFor(roomId, sessions.getToken(socket.id) ?? null);
}

/**
 * 룸 안의 모든 소켓에게 viewer 시점 마스킹된 room:state 를 emit.
 *  - 익명 효과가 없으면 한 번에 broadcast (기존 동작과 동일)
 *  - 익명 효과가 있으면 소켓별로 viewerToken 으로 마스킹된 room 을 개별 emit
 */
export function emitRoomStateToRoom(io: IO, roomId: string): void {
  const room = roomStore.getClientRoom(roomId);
  if (!room) return;

  const state = getRoomShopState(roomId);
  if (!state || state.anonymizedTokens.size === 0) {
    io.to(socketRoom(roomId)).emit('room:state', room);
    return;
  }

  const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
  if (!sockets || sockets.size === 0) {
    io.to(socketRoom(roomId)).emit('room:state', room);
    return;
  }
  for (const sid of sockets) {
    const token = sessions.getToken(sid) ?? null;
    const masked = maskRoomForViewer(room, token);
    io.sockets.sockets.get(sid)?.emit('room:state', masked);
  }
}
