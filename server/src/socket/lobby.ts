import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import type { OnlineUser } from '@shared/types/events.js';

function getOnlineUsers(io: IO): OnlineUser[] {
  const users: OnlineUser[] = [];

  for (const [socketId] of io.sockets.sockets) {
    const memberId = sessions.getMemberIdBySocket(socketId);
    if (!memberId) continue;

    const nickname = sessions.getNickname(socketId);
    if (!nickname) continue;

    const roomId = sessions.getRoom(socketId);
    let status: OnlineUser['status'] = 'lobby';
    if (roomId) {
      const room = roomStore.get(roomId);
      status = room?.status === 'playing' ? 'playing' : 'waiting';
    }

    users.push({ memberId, nickname, status });
  }

  users.sort((a, b) => {
    const order = { playing: 0, waiting: 1, lobby: 2 };
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    return a.nickname.localeCompare(b.nickname, 'ko');
  });

  return users;
}

export function broadcastOnlineUsers(io: IO) {
  io.to(LOBBY_ROOM).emit('lobby:users:online', { users: getOnlineUsers(io) });
}

export function registerLobbyHandlers(io: IO, socket: TypedSocket) {
  socket.on('lobby:join', () => {
    if (sessions.getRoom(socket.id)) return;
    socket.join(LOBBY_ROOM);
    socket.emit('lobby:rooms', roomStore.getAllSummaries());
    socket.emit('lobby:users:online', { users: getOnlineUsers(io) });
  });

  socket.on('lobby:leave', () => {
    socket.leave(LOBBY_ROOM);
  });
}

export function broadcastRoomCreated(io: IO, roomId: string) {
  const summary = roomStore.getSummary(roomId);
  if (summary) io.to(LOBBY_ROOM).emit('lobby:room:created', summary);
  broadcastOnlineUsers(io);
}

export function broadcastRoomUpdated(io: IO, roomId: string) {
  const summary = roomStore.getSummary(roomId);
  if (summary) io.to(LOBBY_ROOM).emit('lobby:room:updated', summary);
  broadcastOnlineUsers(io);
}

export function broadcastRoomRemoved(io: IO, roomId: string) {
  io.to(LOBBY_ROOM).emit('lobby:room:removed', roomId);
  broadcastOnlineUsers(io);
}
