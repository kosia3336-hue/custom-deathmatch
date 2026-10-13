import type { Namespace, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../../classic-era/shared/types/events.js';
import { roomStore } from '../store/rooms.js';

type IO = Namespace<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const LOBBY_ROOM = 'lobby';

export function registerLobbyHandlers(io: IO, socket: TypedSocket) {
  socket.on('lobby:join', () => {
    socket.join(LOBBY_ROOM);
    socket.emit('lobby:rooms', roomStore.getAllSummaries());
  });

  socket.on('lobby:leave', () => {
    socket.leave(LOBBY_ROOM);
  });
}

export function broadcastRoomCreated(io: IO, roomId: string) {
  const summary = roomStore.getSummary(roomId);
  if (summary) io.to(LOBBY_ROOM).emit('lobby:room:created', summary);
}

export function broadcastRoomUpdated(io: IO, roomId: string) {
  const summary = roomStore.getSummary(roomId);
  if (summary) io.to(LOBBY_ROOM).emit('lobby:room:updated', summary);
}

export function broadcastRoomRemoved(io: IO, roomId: string) {
  io.to(LOBBY_ROOM).emit('lobby:room:removed', roomId);
}
