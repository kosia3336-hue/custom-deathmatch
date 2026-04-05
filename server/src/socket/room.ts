import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import type { Player } from '@shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { getGameById, getGames } from '../routes/games.js';
import { broadcastRoomCreated, broadcastRoomUpdated, broadcastRoomRemoved } from './lobby.js';
import { startGame, handleGameForfeit } from './game.js';
import { clearRoomStartCountdown, setRoomStartCountdown } from './roomCountdown.js';
import { socketRoom } from './utils.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function makePlayer(socket: TypedSocket, isHost: boolean): Player {
  return {
    id: socket.id,
    nickname: sessions.getNickname(socket.id) ?? '???',
    isHost,
    isReady: false,
    joinedAt: Date.now(),
  };
}

function sendRoomState(io: IO, roomId: string) {
  const room = roomStore.getClientRoom(roomId);
  if (room) io.to(socketRoom(roomId)).emit('room:state', room);
}

export function registerRoomHandlers(io: IO, socket: TypedSocket) {
  socket.on('room:create', (data, callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });

    const isRandom = data.gameId === 'random';
    let game: ReturnType<typeof getGameById>;

    if (isRandom) {
      const all = getGames().filter((g) => g.supportsMulti);
      if (all.length === 0) return callback({ success: false, error: '게임을 찾을 수 없습니다.' });
      game = all[Math.floor(Math.random() * all.length)];
    } else {
      game = getGameById(data.gameId);
    }
    if (!game) return callback({ success: false, error: '게임을 찾을 수 없습니다.' });

    const playMode = isRandom ? 'multi' as const : data.playMode;
    const maxPlayers = isRandom ? game.maxPlayers : data.maxPlayers;

    if (!data.title || data.title.length < 1 || data.title.length > 30) {
      return callback({ success: false, error: '방 제목은 1~30자로 입력해 주세요.' });
    }

    if (playMode === 'multi' && data.roomType === 'private') {
      if (!data.password || data.password.length < 4 || data.password.length > 8) {
        return callback({ success: false, error: '비밀번호는 4~8자리로 입력해 주세요.' });
      }
    }

    const tl = (playMode === 'multi' && !isRandom) ? data.timeLimitSeconds : null;
    if (tl != null && (typeof tl !== 'number' || tl < 10 || tl > 600)) {
      return callback({ success: false, error: '시간제한은 10초~10분 사이로 설정해 주세요.' });
    }

    const host = makePlayer(socket, true);
    const room = roomStore.create({
      title: data.title,
      gameId: game.id,
      gameName: game.name,
      playMode,
      roomType: playMode === 'multi' ? data.roomType : 'public',
      password: data.password,
      maxPlayers,
      minPlayers: game.minPlayers,
      timeLimitSeconds: tl ?? null,
      host,
    });

    socket.join(socketRoom(room.id));
    sessions.setRoom(socket.id, room.id);
    broadcastRoomCreated(io, room.id);

    callback({ success: true, roomId: room.id });

    if (room.playMode === 'solo') {
      startGame(io, room.id);
    }
  });

  socket.on('room:join', (data, callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) {
      if (currentRoom === data.roomId) {
        const clientRoom = roomStore.getClientRoom(data.roomId);
        if (clientRoom) socket.emit('room:state', clientRoom);
        return callback({ success: true, room: clientRoom });
      }
      return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });
    }

    const room = roomStore.get(data.roomId);
    if (!room) return callback({ success: false, error: '이 방은 더 이상 존재하지 않습니다.' });

    if (sessions.isKicked(nickname, data.roomId)) {
      return callback({ success: false, error: '이 방에 다시 입장할 수 없습니다.' });
    }

    if (room.status === 'playing') {
      return callback({ success: false, error: '이미 게임이 진행 중입니다.', errorCode: 'GAME_IN_PROGRESS', isPrivate: room.roomType === 'private' });
    }

    if (room.players.length >= room.maxPlayers) {
      return callback({ success: false, error: '방이 가득 찼습니다.', errorCode: 'ROOM_FULL', isPrivate: room.roomType === 'private' });
    }

    if (room.roomType === 'private' && !data.inviteToken) {
      const pw = roomStore.getPassword(data.roomId);
      if (pw && data.password !== pw) {
        return callback({ success: false, error: '비밀번호가 틀렸습니다.' });
      }
    }

    if (data.inviteToken) {
      const tokenRoom = roomStore.getRoomByInviteToken(data.inviteToken);
      if (tokenRoom !== data.roomId) {
        return callback({ success: false, error: '유효하지 않은 초대 링크입니다.' });
      }
    }

    const player = makePlayer(socket, false);
    const added = roomStore.addPlayer(data.roomId, player);
    if (!added) return callback({ success: false, error: '입장에 실패했습니다.' });

    socket.join(socketRoom(data.roomId));
    sessions.setRoom(socket.id, data.roomId);

    io.to(socketRoom(data.roomId)).emit('room:player:joined', player);
    broadcastRoomUpdated(io, data.roomId);
    sendRoomState(io, data.roomId);

    const clientRoom = roomStore.getClientRoom(data.roomId);
    callback({ success: true, room: clientRoom });
  });

  socket.on('room:quickjoin', (callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });

    const found = roomStore.findQuickJoinRoom();
    if (found) {
      const player = makePlayer(socket, false);
      const added = roomStore.addPlayer(found.id, player);
      if (!added) return callback({ success: false, error: '입장에 실패했습니다.' });
      socket.join(socketRoom(found.id));
      sessions.setRoom(socket.id, found.id);
      io.to(socketRoom(found.id)).emit('room:player:joined', player);
      broadcastRoomUpdated(io, found.id);
      sendRoomState(io, found.id);
      const clientRoom = roomStore.getClientRoom(found.id);
      if (!clientRoom) {
        return callback({ success: false, error: '입장에 실패했습니다.' });
      }
      return callback({ success: true, room: clientRoom, roomId: found.id });
    }

    return callback({ success: false, error: '입장 가능한 방이 없습니다. 새 방을 만들어 보세요.' });
  });

  socket.on('room:leave', () => {
    handleLeaveRoom(io, socket);
  });

  socket.on('room:ready', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    roomStore.setPlayerReady(roomId, socket.id, true);
    io.to(socketRoom(roomId)).emit('room:player:ready', { playerId: socket.id });
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:unready', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    roomStore.setPlayerReady(roomId, socket.id, false);
    io.to(socketRoom(roomId)).emit('room:player:unready', { playerId: socket.id });
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:kick', ({ targetId }) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    const targetSocket = io.sockets.sockets.get(targetId);
    if (!targetSocket) return;

    const targetNickname = sessions.getNickname(targetId);
    if (targetNickname) sessions.addKick(targetNickname, roomId);

    roomStore.removePlayer(roomId, targetId);
    sessions.clearRoom(targetId);
    targetSocket.leave(socketRoom(roomId));
    targetSocket.emit('kicked', { reason: '방장에 의해 퇴장되었습니다.' });

    io.to(socketRoom(roomId)).emit('room:player:kicked', { playerId: targetId });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:delegate', ({ targetId }) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    const success = roomStore.delegateHost(roomId, targetId);
    if (success) {
      io.to(socketRoom(roomId)).emit('room:host:changed', { newHostId: targetId });
      sendRoomState(io, roomId);
    }
  });

  socket.on('room:start', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    const check = roomStore.canStart(roomId);
    if (!check.ok) {
      socket.emit('error', { message: check.reason ?? '시작할 수 없습니다.' });
      return;
    }

    // 3, 2, 1 순서로 방송 후 즉시 게임 시작 (0은 표시하지 않음)
    let count = 3;
    const interval = setInterval(() => {
      io.to(socketRoom(roomId)).emit('room:countdown', { count });
      count--;
      if (count < 1) {
        clearRoomStartCountdown(roomId);
        const still = roomStore.get(roomId);
        if (still && still.status === 'waiting') {
          startGame(io, roomId);
        }
      }
    }, 1000);
    setRoomStartCountdown(roomId, interval);
  });

  socket.on('room:settings:update', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    roomStore.updateSettings(roomId, data);
    io.to(socketRoom(roomId)).emit('room:settings:updated', data);
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:swap:colors', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
    if (room.playMode === 'solo') return;
    roomStore.swapPlayers(roomId);
    sendRoomState(io, roomId);
  });

  socket.on('room:invite:create', (callback) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return callback({ success: false });
    const token = roomStore.createInviteToken(roomId);
    callback({ success: true, token });
  });

  socket.on('spectate:join', ({ roomId, password }, callback) => {
    const room = roomStore.get(roomId);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom && currentRoom !== roomId) {
      return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });
    }

    if (sessions.isKicked(sessions.getNickname(socket.id) ?? '', roomId)) {
      return callback({ success: false, error: '이 방에 다시 입장할 수 없습니다.' });
    }

    if (room.roomType === 'private') {
      const pw = roomStore.getPassword(roomId);
      if (pw && password !== pw) {
        return callback({ success: false, error: '비밀번호가 틀렸습니다.' });
      }
    }

    const spectator = makePlayer(socket, false);
    roomStore.addSpectator(roomId, spectator);
    socket.join(socketRoom(roomId));
    sessions.setRoom(socket.id, roomId);

    const clientRoom = roomStore.getClientRoom(roomId);
    callback({ success: true, room: clientRoom });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('spectate:leave', () => {
    handleLeaveRoom(io, socket);
  });

  socket.on('room:to:spectate', (callback) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return callback({ success: false, error: '방에 입장되어 있지 않습니다.' });

    const room = roomStore.get(roomId);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });
    if (room.hostId === socket.id) {
      return callback({ success: false, error: '방장은 관전자로 전환할 수 없습니다.' });
    }

    const moved = roomStore.moveToSpectator(roomId, socket.id);
    if (!moved) return callback({ success: false, error: '전환에 실패했습니다.' });

    callback({ success: true });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('spectate:to:player', (callback) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return callback({ success: false, error: '방에 입장되어 있지 않습니다.' });

    const room = roomStore.get(roomId);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });
    if (room.players.length >= room.maxPlayers) {
      return callback({ success: false, error: '빈 자리가 없습니다.' });
    }

    const moved = roomStore.moveToPlayer(roomId, socket.id);
    if (!moved) return callback({ success: false, error: '전환에 실패했습니다.' });

    callback({ success: true });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });
}

export function handleLeaveRoom(io: IO, socket: TypedSocket) {
  const roomId = sessions.getRoom(socket.id);
  if (!roomId) return;

  const roomBefore = roomStore.get(roomId);
  const leavingWasHost = roomBefore?.hostId === socket.id;
  const leavingNickname =
    roomBefore?.players.find((p: Player) => p.id === socket.id)?.nickname ??
    roomBefore?.spectators.find((p: Player) => p.id === socket.id)?.nickname ??
    sessions.getNickname(socket.id) ??
    '알 수 없음';
  const spectatorsBefore: Player[] = roomBefore?.spectators ?? [];

  if (leavingWasHost) {
    clearRoomStartCountdown(roomId);
  }

  handleGameForfeit(io, roomId, socket.id);

  const result = roomStore.removePlayer(roomId, socket.id);
  sessions.clearRoom(socket.id);
  socket.leave(socketRoom(roomId));

  if (result.destroyed) {
    io.to(socketRoom(roomId)).emit('room:disbanded', { reason: '모든 플레이어가 나가 방이 종료되었습니다.' });
    spectatorsBefore.forEach((s) => sessions.clearRoom(s.id));
    sessions.clearRoomFromAllKicks(roomId);
    broadcastRoomRemoved(io, roomId);
    return;
  }

  if (result.newHostId) {
    io.to(socketRoom(roomId)).emit('room:host:changed', { newHostId: result.newHostId });
  }

  io.to(socketRoom(roomId)).emit('room:player:left', {
    playerId: socket.id,
    nickname: leavingNickname,
    newHostId: result.newHostId,
  });

  sendRoomState(io, roomId);
  broadcastRoomUpdated(io, roomId);
}
