import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { socketRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';

const lastMessageTime = new Map<string, number>();
const COOLDOWN_MS = 500;

export function registerChatHandlers(io: IO, socket: TypedSocket) {
  socket.on('disconnect', () => {
    lastMessageTime.delete(socket.id);
  });

  socket.on('chat:send', ({ message, scope }) => {
    const trimmed = message?.trim() ?? '';
    if (trimmed.length === 0 || trimmed.length > 200) return;

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
      message: trimmed,
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

