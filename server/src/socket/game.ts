import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, GameState, GameResult } from '../../../shared/types/events.js';
import type { Player } from '../../../shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { broadcastRoomUpdated, broadcastRoomRemoved } from './lobby.js';
import { clearRoomStartCountdown } from './roomCountdown.js';
import config from '../config.js';
import {
  initFourGravity,
  handleFourGravityAction,
  cleanupFourGravity,
  getFourGravityState,
  emitFourGravityStateToSocket,
  registerEndGameCallback,
} from './games/four-gravity.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function socketRoom(roomId: string) {
  return `room:${roomId}`;
}

const autoEndTimers = new Map<string, NodeJS.Timeout>();

// 게임 실제 시작 시각 추적 (방 생성 시각이 아닌 게임 시작 시각으로 플레이 시간 계산)
const gameStartTimes = new Map<string, number>();

export function startGame(io: IO, roomId: string) {
  const room = roomStore.get(roomId);
  if (!room) return;

  const startedAt = Date.now();
  gameStartTimes.set(roomId, startedAt);

  roomStore.setStatus(roomId, 'playing');

  const clientRoom = roomStore.getClientRoom(roomId);
  if (clientRoom) io.to(socketRoom(roomId)).emit('room:state', clientRoom);

  io.to(socketRoom(roomId)).emit('room:game:started');

  if (room.gameId === 'game-001') {
    initFourGravity(io, roomId, room.players, room.playMode, startedAt);
  } else {
    const state: GameState = {
      roomId,
      message: '게임이 시작되었습니다! (게임 모듈 플레이스홀더)',
      currentTurn: room.players[0]?.id ?? null,
      turnNumber: 1,
      startedAt,
    };
    io.to(socketRoom(roomId)).emit('game:state', state);
  }
  broadcastRoomUpdated(io, roomId);
}

export function registerGameHandlers(io: IO, socket: TypedSocket) {
  registerEndGameCallback((cbIo, roomId, data) => {
    endGame(cbIo, roomId, data);
  });

  socket.on('game:sync', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    const clientRoom = roomStore.getClientRoom(roomId);
    if (clientRoom) socket.emit('room:state', clientRoom);

    if (room.gameId === 'game-001') {
      emitFourGravityStateToSocket(socket, roomId);
    }
  });

  socket.on('game:action', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    if (room.gameId === 'game-001') {
      handleFourGravityAction(io, socket, roomId, data);
    }
  });

  socket.on('game:end', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    if (room.gameId === 'game-001') cleanupFourGravity(roomId);
    endGame(io, roomId);
  });

  socket.on('game:rematch', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;

    clearAutoEnd(roomId);

    if (room.playMode === 'multi') {
      roomStore.resetForRematch(roomId);
      const clientRoom = roomStore.getClientRoom(roomId);
      if (clientRoom) io.to(socketRoom(roomId)).emit('room:state', clientRoom);
      broadcastRoomUpdated(io, roomId);
    } else {
      startGame(io, roomId);
    }
  });

  socket.on('game:leave', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;

    const room = roomStore.get(roomId);

    if (room && room.status === 'playing' && room.gameId === 'game-001') {
      const fgState = getFourGravityState(roomId);
      if (fgState && !fgState.gameOver && room.playMode === 'multi') {
        const other = room.players.find((p) => p.id !== socket.id);
        if (other) {
          endGame(io, roomId, {
            rankings: [
              { playerId: other.id, nickname: other.nickname, rank: 1, score: 1 },
              { playerId: socket.id, nickname: sessions.getNickname(socket.id) ?? '???', rank: 2, score: 0 },
            ],
            totalTurns: fgState.turnNumber,
          });
        }
      }
      cleanupFourGravity(roomId);
    }

    const result = roomStore.removePlayer(roomId, socket.id);
    sessions.clearRoom(socket.id);
    socket.leave(socketRoom(roomId));

    if (result.destroyed) {
      clearAutoEnd(roomId);
      gameStartTimes.delete(roomId);
      sessions.clearRoomFromAllKicks(roomId);
      broadcastRoomRemoved(io, roomId);
    } else {
      if (result.newHostId) {
        io.to(socketRoom(roomId)).emit('room:host:changed', { newHostId: result.newHostId });
      }
      io.to(socketRoom(roomId)).emit('room:player:left', {
        playerId: socket.id,
        newHostId: result.newHostId,
      });
      broadcastRoomUpdated(io, roomId);
    }
  });
}

export function endGame(
  io: IO,
  roomId: string,
  data?: { rankings?: GameResult['rankings']; totalTurns?: number; gameResultData?: unknown },
) {
  const room = roomStore.get(roomId);
  if (!room) return;

  roomStore.setStatus(roomId, 'finished');

  const startedAt = gameStartTimes.get(roomId) ?? room.createdAt;
  const playTime = Date.now() - startedAt;
  gameStartTimes.delete(roomId);

  const result: GameResult = {
    roomId,
    rankings: data?.rankings ?? room.players.map((p: Player, i: number) => ({
      playerId: p.id,
      nickname: p.nickname,
      rank: i + 1,
      score: 0,
    })),
    playTime,
    totalTurns: data?.totalTurns ?? 0,
    ...(data?.gameResultData != null && { gameResultData: data.gameResultData }),
  };

  io.to(socketRoom(roomId)).emit('game:ended', result);
  broadcastRoomUpdated(io, roomId);

  const timer = setTimeout(() => {
    const r = roomStore.get(roomId);
    if (r && r.status === 'finished') {
      io.to(socketRoom(roomId)).emit('room:disbanded', { reason: '시간 초과로 방이 종료되었습니다.' });
      r.players.forEach((p: Player) => sessions.clearRoom(p.id));
      r.spectators.forEach((p: Player) => sessions.clearRoom(p.id));
      clearRoomStartCountdown(roomId);
      sessions.clearRoomFromAllKicks(roomId);
      roomStore.delete(roomId);
      broadcastRoomRemoved(io, roomId);
    }
    autoEndTimers.delete(roomId);
  }, config.roomAutoDestroyDelay);

  autoEndTimers.set(roomId, timer);
}

function clearAutoEnd(roomId: string) {
  const timer = autoEndTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    autoEndTimers.delete(roomId);
  }
}
