import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { registerLobbyHandlers } from './lobby.js';
import { registerRoomHandlers, handleLeaveRoom } from './room.js';
import { registerGameHandlers } from './game.js';
import { registerChatHandlers } from './chat.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: IO) {
  io.on('connection', (socket) => {
    socket.on('nickname:set', ({ nickname }, callback) => {
      const trimmed = nickname.trim();

      if (trimmed.length < 2 || trimmed.length > 12) {
        return callback({ success: false, error: '2~12자로 입력해 주세요.' });
      }

      if (sessions.isNicknameTaken(trimmed) && sessions.getSocketByNickname(trimmed) !== socket.id) {
        return callback({ success: false, error: '이미 사용 중인 닉네임입니다.' });
      }

      sessions.setNickname(socket.id, trimmed);
      callback({ success: true, nickname: trimmed });
    });

    registerLobbyHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      handleLeaveRoom(io, socket);
      sessions.removeSession(socket.id);
    });
  });
}
