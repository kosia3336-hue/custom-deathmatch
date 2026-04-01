import { v4 as uuid } from 'uuid';
import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, ChatMessage } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const LOBBY_ROOM = 'lobby';
const lastMessageTime = new Map<string, number>();
const COOLDOWN_MS = 2000;

function socketRoom(roomId: string) {
  return `room:${roomId}`;
}

export function registerChatHandlers(io: IO, socket: TypedSocket) {
  socket.on('chat:send', ({ message, scope }) => {
    if (!message || message.length === 0 || message.length > 200) return;

    const now = Date.now();
    const last = lastMessageTime.get(socket.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    lastMessageTime.set(socket.id, now);

    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return;

    const msg: ChatMessage = {
      id: uuid(),
      sender: socket.id,
      senderNickname: nickname,
      message: message.trim(),
      scope,
      isSystem: false,
      timestamp: now,
    };

    if (scope === 'lobby') {
      io.to(LOBBY_ROOM).emit('chat:message', msg);
    } else {
      const roomId = sessions.getRoom(socket.id);
      if (roomId) {
        io.to(socketRoom(roomId)).emit('chat:message', msg);
      }
    }
  });
}

export function sendSystemMessage(io: IO, target: string, message: string, scope: 'lobby' | 'room' | 'game') {
  const msg: ChatMessage = {
    id: uuid(),
    sender: 'system',
    senderNickname: '시스템',
    message,
    scope,
    isSystem: true,
    timestamp: Date.now(),
  };
  io.to(target).emit('chat:message', msg);
}
