import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import type { OnlineUser } from '@shared/types/events.js';
import { isTokenAnonymized } from '../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { isDummyPlayerId } from '@shared/dummy.js';
import { listLiveDummyOnlineUsers } from '../dummy/live/online.js';

function isDevSandboxRoom(roomId: string): boolean {
  const room = roomStore.get(roomId);
  if (!room) return false;
  if (room.gameOptions?.superAi === true) return true;
  return room.players.some((p) => isDummyPlayerId(p.id));
}

export function onlineUsersPayload(
  nickname: string | undefined,
  users: OnlineUser[],
): { users: OnlineUser[]; count: number } {
  const count = users.length;
  if (nickname === '천하') return { users, count };
  return { users: [], count };
}

function emitOnlineUsers(socket: TypedSocket, users: OnlineUser[]) {
  socket.emit('lobby:users:online', onlineUsersPayload(sessions.getNickname(socket.id), users));
}

export function mergeOnlineUsers(fromSockets: OnlineUser[], extras: OnlineUser[]): OnlineUser[] {
  const seen = new Set(fromSockets.map((u) => u.memberId));
  const users = fromSockets.slice();
  for (const extra of extras) {
    if (seen.has(extra.memberId)) continue;
    seen.add(extra.memberId);
    users.push(extra);
  }
  users.sort((a, b) => {
    const order = { playing: 0, waiting: 1, lobby: 2 };
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    return a.nickname.localeCompare(b.nickname, 'ko');
  });
  return users;
}

function getOnlineUsers(io: IO): OnlineUser[] {
  const fromSockets: OnlineUser[] = [];

  for (const [socketId] of io.sockets.sockets) {
    const memberId = sessions.getMemberIdBySocket(socketId);
    if (!memberId) continue;

    const nickname = sessions.getNickname(socketId);
    if (!nickname) continue;

    const token = sessions.getToken(socketId);
    const roomId = sessions.getRoom(socketId);
    let status: OnlineUser['status'] = 'lobby';
    if (roomId) {
      const room = roomStore.get(roomId);
      status = room?.status === 'playing' ? 'playing' : 'waiting';
    }

    const isAnon = !!(roomId && token && isTokenAnonymized(roomId, token));
    fromSockets.push({ memberId, nickname: isAnon ? ANONYMOUS_NICKNAME : nickname, status });
  }

  return mergeOnlineUsers(fromSockets, listLiveDummyOnlineUsers());
}

export function broadcastOnlineUsers(io: IO) {
  const users = getOnlineUsers(io);
  for (const socket of io.sockets.sockets.values()) {
    if (!socket.rooms.has(LOBBY_ROOM)) continue;
    emitOnlineUsers(socket, users);
  }
}

export function registerLobbyHandlers(io: IO, socket: TypedSocket) {
  socket.on('lobby:join', () => {
    // v2.2: 방 안에서도 로비 채팅/접속자 현황에 접근할 수 있도록, 방에 속해있어도
    // LOBBY_ROOM 에는 계속 합류시킨다(중복 소켓방 가입은 안전·멱등). 방 목록(lobby:rooms)
    // 자동 갱신은 로비 페이지에서만 의미가 있지만, 그냥 받아도 무해하다.
    socket.join(LOBBY_ROOM);
    socket.emit('lobby:rooms', roomStore.getAllSummaries());
    emitOnlineUsers(socket, getOnlineUsers(io));
  });

  socket.on('lobby:leave', () => {
    socket.leave(LOBBY_ROOM);
  });
}

export function broadcastRoomCreated(io: IO, roomId: string) {
  if (!isDevSandboxRoom(roomId)) {
    const summary = roomStore.getSummary(roomId);
    if (summary) io.to(LOBBY_ROOM).emit('lobby:room:created', summary);
  }
  broadcastOnlineUsers(io);
}

export function broadcastRoomUpdated(io: IO, roomId: string) {
  if (!isDevSandboxRoom(roomId)) {
    const summary = roomStore.getSummary(roomId);
    if (summary) io.to(LOBBY_ROOM).emit('lobby:room:updated', summary);
  }
  broadcastOnlineUsers(io);
}

export function broadcastRoomRemoved(io: IO, roomId: string) {
  io.to(LOBBY_ROOM).emit('lobby:room:removed', roomId);
  broadcastOnlineUsers(io);
}
