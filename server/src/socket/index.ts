import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { registerLobbyHandlers } from './lobby.js';
import { registerRoomHandlers, handleLeaveRoom } from './room.js';
import { registerGameHandlers, emitGameStateToSocket } from './game.js';
import { registerChatHandlers } from './chat.js';
import { socketRoom } from './utils.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/** 인게임 재연결 유예 시간 (ms) */
const RECONNECT_GRACE_PLAYING = 30_000;

export function setupSocketHandlers(io: IO) {
  io.on('connection', (socket) => {

    // ── 세션 복원 ─────────────────────────────────────────────────────────
    socket.on('session:restore', ({ token }) => {
      // 기존 소켓이 아직 살아있으면 새 탭 시나리오 → 새 탭에 알리고 기존 탭 유지
      const prevSocketId = sessions.getSocketByToken(token);
      if (prevSocketId && prevSocketId !== socket.id && io.sockets.sockets.has(prevSocketId)) {
        socket.emit('connection:duplicate');
        return;
      }

      const result = sessions.linkToken(socket.id, token);

      if (result === 'restored') {
        const nickname = sessions.getNickname(socket.id);
        const roomId = sessions.getRoom(socket.id);

        if (!nickname) {
          // 닉네임 없으면 신규 세션과 동일하게 처리
          return;
        }

        // 재연결 유예 타이머 취소
        sessions.clearPendingDisconnect(token);

        if (roomId) {
          const room = roomStore.get(roomId);
          if (room) {
            // socket.io room 재입장
            socket.join(socketRoom(roomId));

            // room:state + game:state 재전송
            const clientRoom = roomStore.getClientRoom(roomId);
            if (clientRoom) socket.emit('room:state', clientRoom);
            if (room.status === 'playing') emitGameStateToSocket(socket, roomId, room.gameId);

            // 방 전체에 재연결 성공 알림 (playerId = token = Player.id)
            io.to(socketRoom(roomId)).emit('player:reconnected', {
              playerId: token,
              nickname,
            });
          }
        }

        socket.emit('session:restored', { nickname, roomId: roomId ?? undefined });
      }
      // result === 'new': 신규 세션, 아무것도 하지 않음 (기존 흐름대로 nickname:set 기다림)
    });

    // ── 닉네임 설정 ───────────────────────────────────────────────────────
    socket.on('nickname:set', ({ nickname }, callback) => {
      const trimmed = nickname.trim();

      if (trimmed.length < 2 || trimmed.length > 12) {
        return callback({ success: false, error: '2~12자로 입력해 주세요.' });
      }

      if (sessions.getNickname(socket.id) === trimmed) {
        return callback({ success: true, nickname: trimmed });
      }

      const ok = sessions.setNickname(socket.id, trimmed);
      if (!ok) {
        return callback({ success: false, error: '이미 사용 중인 닉네임입니다.' });
      }

      callback({ success: true, nickname: trimmed });
    });

    registerLobbyHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerChatHandlers(io, socket);

    // ── 연결 끊김 ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const token = sessions.getToken(socket.id);
      const roomId = sessions.getRoom(socket.id);

      if (token && roomId) {
        const room = roomStore.get(roomId);
        // token = Player.id 이므로 직접 비교
        const isPlayer = room?.players.some((p) => p.id === token) ?? false;

        if (isPlayer && room?.status === 'playing') {
          // ─── 인게임: 30초 유예 ─────────────────────────────────────────
          const nickname = sessions.getNickname(socket.id) ?? '알 수 없음';

          socket.to(socketRoom(roomId)).emit('player:reconnecting', {
            playerId: token,
            nickname,
            secondsLeft: RECONNECT_GRACE_PLAYING / 1000,
          });

          const timer = setTimeout(() => {
            handleLeaveRoom(io, socket);
            sessions.removeSession(socket.id);
          }, RECONNECT_GRACE_PLAYING);

          sessions.setPendingDisconnect(token, timer);
          return;
        }
        // 대기실 포함 그 외: 즉시 퇴장
      }

      handleLeaveRoom(io, socket);
      sessions.removeSession(socket.id);
    });
  });
}
