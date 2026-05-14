import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { socketRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import { roomStore } from '../store/rooms.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import { maskChatMessageForViewer } from '../shop/maskNicknames.js';

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
    const token = sessions.getToken(socket.id);
    if (!nickname || !token) return;

    const senderTitle = sessions.getDisplayedTitleBySocket(socket.id);
    const senderMemberId = sessions.getMemberIdBySocket(socket.id);

    // v2.1: 로비 채팅 — 로그인 회원 + 방에 속해있지 않은 유저만
    if (scope === 'lobby') {
      if (!senderMemberId) return; // 게스트 차단
      if (sessions.getRoom(socket.id)) return; // 방/관전 중 차단

      const lobbyMsg: ChatMessage = {
        id: uuid(),
        sender: socket.id,
        senderNickname: nickname,
        message: trimmed,
        scope: 'lobby',
        isSystem: false,
        timestamp: now,
        senderTitle: senderTitle ?? null,
        isSpectator: false,
        senderMemberId: senderMemberId ?? null,
      };

      io.to(LOBBY_ROOM).emit('chat:message', lobbyMsg);
      return;
    }

    // room / game 스코프
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;

    // v2: 관전자도 채팅 가능 (6번 §6.7 / 7번 §7.5)
    const isSpectator = room.spectators.some((s) => s.id === token);
    const isPlayer = room.players.some((p) => p.id === token);
    if (!isSpectator && !isPlayer) return;

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

    // 익명 효과가 있으면 viewer 별 분기 emit, 아니면 broadcast.
    const shopState = getRoomShopState(roomId);
    if (
      shopState
      && shopState.anonymizedMemberIds.size > 0
      && senderMemberId
      && shopState.anonymizedMemberIds.has(senderMemberId)
    ) {
      const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
      if (sockets) {
        for (const sid of sockets) {
          const viewerMid = sessions.getMemberIdBySocket(sid);
          const masked = maskChatMessageForViewer(roomId, msg, viewerMid);
          io.sockets.sockets.get(sid)?.emit('chat:message', masked);
        }
        return;
      }
    }

    io.to(socketRoom(roomId)).emit('chat:message', msg);
  });
}
