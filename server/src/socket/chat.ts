import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { socketRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import { roomStore } from '../store/rooms.js';

const lastMessageTime = new Map<string, number>();
const COOLDOWN_MS = 500;

export function registerChatHandlers(io: IO, socket: TypedSocket) {
  socket.on('disconnect', () => {
    lastMessageTime.delete(socket.id);
  });

  socket.on('chat:send', ({ message, scope }) => {
    // v2: 로비 채팅은 폐기 (5번 §5.7)
    if (scope === 'lobby') return;

    const trimmed = message?.trim() ?? '';
    if (trimmed.length === 0 || trimmed.length > 200) return;

    const now = Date.now();
    const last = lastMessageTime.get(socket.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    lastMessageTime.set(socket.id, now);

    const nickname = sessions.getNickname(socket.id);
    const token = sessions.getToken(socket.id);
    if (!nickname || !token) return;

    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;

    // v2: 관전자도 채팅 가능 (6번 §6.7 / 7번 §7.5)
    const isSpectator = room.spectators.some((s) => s.id === token);
    const isPlayer = room.players.some((p) => p.id === token);
    if (!isSpectator && !isPlayer) return;

    const senderTitle = sessions.getDisplayedTitleBySocket(socket.id);
    const senderMemberId = sessions.getMemberIdBySocket(socket.id);

    const msg: ChatMessage = {
      id: uuid(),
      sender: socket.id,
      senderNickname: nickname,
      message: trimmed,
      scope,
      isSystem: false,
      timestamp: now,
      senderTitle: senderTitle ?? null,
      isSpectator,
      senderMemberId: senderMemberId ?? null,
    };

    io.to(socketRoom(roomId)).emit('chat:message', msg);
  });
}

