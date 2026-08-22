import { v4 as uuid } from 'uuid';
import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { getGameById, getGames } from '../routes/games.js';
import {
  broadcastRoomCreated,
  broadcastRoomUpdated,
  broadcastRoomRemoved,
  broadcastOnlineUsers,
} from './lobby.js';
import { startGame, handleGameForfeit, clearAutoEnd, clearGameStartTime } from './game.js';
import {
  clearRoomStartCountdown,
  setRoomStartCountdown,
  hasRoomStartCountdown,
} from './roomCountdown.js';
import { socketRoom, emitRoomStateToRoom, maskedClientRoomForSocket } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import {
  isRoomSpectatorLocked,
  getRoomShopState,
  cleanupRoomShopState,
  isTokenAnonymized,
} from '../shop/roomShopState.js';
import { maskRoomForViewer, ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { eventRoom } from './eventRoom.js';
import { smsEventRoom, EVENT_SMS_ROOM_KEY } from './smsEventRoomHandlers.js';
import { EVENT_ROOM_KEY } from './eventRoom.js';
import { destroyOrphanedDummyRoom, stopDummyAgent } from '../dummy/match.js';

/** 소켓의 Player.id (= localStorage 토큰)를 반환. 토큰 없으면 socket.id를 폴백으로 사용 */
function getPlayerId(socket: TypedSocket): string {
  return sessions.getToken(socket.id) ?? socket.id;
}

// ── 비공개 방 비밀번호 무차별 대입 방지 ─────────────────────────────────────
// 비밀번호는 4~8자리라 제한이 없으면 짧은 시간 안에 전수 대입이 가능하다.
// 재접속으로 초기화되지 않도록 소켓이 아닌 회원 기준으로 실패를 센다.
const PW_MAX_FAILURES = 5;
const PW_LOCKOUT_MS = 60_000;
const passwordFailures = new Map<string, { fails: number; lockedUntil: number }>();

function pwKey(socket: TypedSocket): string {
  return sessions.getMemberIdBySocket(socket.id) ?? socket.id;
}

function isPasswordLockedOut(socket: TypedSocket): boolean {
  const entry = passwordFailures.get(pwKey(socket));
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil !== 0) passwordFailures.delete(pwKey(socket));
  return false;
}

function recordPasswordFailure(socket: TypedSocket): void {
  const key = pwKey(socket);
  const entry = passwordFailures.get(key) ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= PW_MAX_FAILURES) {
    entry.fails = 0;
    entry.lockedUntil = Date.now() + PW_LOCKOUT_MS;
  }
  passwordFailures.set(key, entry);
}

function clearPasswordFailures(socket: TypedSocket): void {
  passwordFailures.delete(pwKey(socket));
}

function makePlayer(socket: TypedSocket, isHost: boolean): Player {
  return {
    id: getPlayerId(socket),
    nickname: sessions.getNickname(socket.id) ?? '???',
    isHost,
    isReady: false,
    joinedAt: Date.now(),
    // v2: 회원 정보 자동 첨부
    memberId: sessions.getMemberIdBySocket(socket.id),
    displayedTitle: sessions.getDisplayedTitleBySocket(socket.id),
    equippedSkins: sessions.getEquippedSkinsBySocket(socket.id),
  };
}

function sendRoomState(io: IO, roomId: string) {
  emitRoomStateToRoom(io, roomId);
}

function supportsPlayMode(
  game: NonNullable<ReturnType<typeof getGameById>>,
  playMode: PlayMode,
): boolean {
  if (playMode === 'multi') return game.supportsMulti;
  if (playMode === 'com') return game.supportsCom;
  return game.supportsSolo;
}

function emitRoomSystemMessage(io: IO, roomId: string, message: string): void {
  io.to(socketRoom(roomId)).emit('chat:message', {
    id: uuid(),
    sender: 'system',
    senderNickname: '시스템',
    message,
    scope: 'room',
    isSystem: true,
    timestamp: Date.now(),
  });
}

export function registerRoomHandlers(io: IO, socket: TypedSocket) {
  socket.on('room:create', (data, callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });

    if (!data.title || data.title.length < 1 || data.title.length > 30) {
      return callback({ success: false, error: '방 제목은 1~30자로 입력해 주세요.' });
    }

    // ── 밴픽 모드 ─────────────────────────────────────────────────────────
    if (data.gameId === 'ban-pick') {
      const bpPlayMode = data.playMode === 'com' ? ('com' as const) : ('multi' as const);
      if (data.roomType === 'private') {
        if (!data.password || data.password.length < 4 || data.password.length > 8) {
          return callback({ success: false, error: '비밀번호는 4~8자리로 입력해 주세요.' });
        }
      }
      const tl = bpPlayMode === 'multi' ? (data.timeLimitSeconds ?? null) : null;
      if (tl != null && (typeof tl !== 'number' || tl < 10 || tl > 600)) {
        return callback({ success: false, error: '시간제한은 10초~10분 사이로 설정해 주세요.' });
      }
      const rawBanCount =
        typeof data.gameOptions?.banCount === 'number' ? data.gameOptions.banCount : 3;
      const host = makePlayer(socket, true);
      const room = roomStore.create({
        title: data.title,
        gameId: 'ban-pick',
        gameName: '밴픽',
        playMode: bpPlayMode,
        roomType: data.roomType,
        password: data.password,
        maxPlayers: 2,
        minPlayers: 2,
        timeLimitSeconds: tl,
        gameOptions: { banCount: rawBanCount },
        host,
      });
      // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
      socket.join(socketRoom(room.id));
      sessions.setRoom(socket.id, room.id);
      broadcastRoomCreated(io, room.id);
      return callback({ success: true, roomId: room.id });
    }
    // ─────────────────────────────────────────────────────────────────────

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

    const playMode = isRandom ? ('multi' as const) : data.playMode;
    const maxPlayers = isRandom ? game.maxPlayers : data.maxPlayers;

    if (!supportsPlayMode(game, playMode)) {
      return callback({
        success: false,
        error: '선택한 게임은 이 플레이 모드를 지원하지 않습니다.',
      });
    }

    if (playMode !== 'solo' && data.roomType === 'private') {
      if (!data.password || data.password.length < 4 || data.password.length > 8) {
        return callback({ success: false, error: '비밀번호는 4~8자리로 입력해 주세요.' });
      }
    }

    const tl = playMode === 'multi' && !isRandom ? data.timeLimitSeconds : null;
    if (tl != null && (typeof tl !== 'number' || tl < 10 || tl > 600)) {
      return callback({ success: false, error: '시간제한은 10초~10분 사이로 설정해 주세요.' });
    }

    const gameOptions =
      !isRandom && data.gameOptions && typeof data.gameOptions === 'object' ? data.gameOptions : {};

    const host = makePlayer(socket, true);
    const room = roomStore.create({
      title: data.title,
      gameId: game.id,
      gameName: game.name,
      playMode,
      roomType: playMode === 'solo' ? 'public' : data.roomType,
      password: data.password,
      maxPlayers,
      minPlayers: game.minPlayers,
      timeLimitSeconds: tl ?? null,
      gameOptions,
      host,
    });

    // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
    socket.join(socketRoom(room.id));
    sessions.setRoom(socket.id, room.id);
    broadcastRoomCreated(io, room.id);

    if (room.playMode === 'solo') {
      startGame(io, room.id);
    }

    callback({ success: true, roomId: room.id });
  });

  socket.on('room:join', (data, callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) {
      if (currentRoom === data.roomId) {
        const clientRoom = maskedClientRoomForSocket(data.roomId, socket);
        if (clientRoom) socket.emit('room:state', clientRoom);
        return callback({ success: true, room: clientRoom ?? undefined });
      }
      return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });
    }

    const room = roomStore.get(data.roomId);
    if (!room) return callback({ success: false, error: '이 방은 더 이상 존재하지 않습니다.' });

    // 세션 복원 후 재입장: 이미 room.players에 있는 토큰이면 소켓만 재입장 (관전자 폴백 방지)
    const token = sessions.getToken(socket.id);
    if (token && room.players.find((p) => p.id === token)) {
      // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
      socket.join(socketRoom(data.roomId));
      sessions.setRoom(socket.id, data.roomId);
      const clientRoom = maskedClientRoomForSocket(data.roomId, socket);
      if (clientRoom) socket.emit('room:state', clientRoom);
      return callback({ success: true, room: clientRoom ?? undefined });
    }

    if (sessions.isKicked(nickname, data.roomId)) {
      return callback({ success: false, error: '이 방에 다시 입장할 수 없습니다.' });
    }

    if (room.status === 'playing') {
      return callback({
        success: false,
        error: '이미 게임이 진행 중입니다.',
        errorCode: 'GAME_IN_PROGRESS',
        isPrivate: room.roomType === 'private',
      });
    }

    if (room.players.length >= room.maxPlayers) {
      return callback({
        success: false,
        error: '방이 가득 찼습니다.',
        errorCode: 'ROOM_FULL',
        isPrivate: room.roomType === 'private',
      });
    }

    if (room.roomType === 'private' && !data.inviteToken) {
      if (isPasswordLockedOut(socket)) {
        return callback({
          success: false,
          error: '비밀번호를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.',
        });
      }
      const pw = roomStore.getPassword(data.roomId);
      if (pw && data.password !== pw) {
        // 비밀번호는 4~8자리라 제한이 없으면 짧은 시간 안에 전수 대입이 가능하다.
        recordPasswordFailure(socket);
        return callback({ success: false, error: '비밀번호가 틀렸습니다.' });
      }
      clearPasswordFailures(socket);
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

    // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
    socket.join(socketRoom(data.roomId));
    sessions.setRoom(socket.id, data.roomId);

    io.to(socketRoom(data.roomId)).emit('room:player:joined', player);
    broadcastRoomUpdated(io, data.roomId);
    sendRoomState(io, data.roomId);

    const clientRoom = maskedClientRoomForSocket(data.roomId, socket);
    callback({ success: true, room: clientRoom });
  });

  socket.on('room:quickjoin', (callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });

    const found = roomStore.findQuickJoinRoom(undefined, (roomId) =>
      sessions.isKicked(nickname, roomId),
    );
    if (found) {
      const player = makePlayer(socket, false);
      const added = roomStore.addPlayer(found.id, player);
      if (!added) return callback({ success: false, error: '입장에 실패했습니다.' });
      // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
      socket.join(socketRoom(found.id));
      sessions.setRoom(socket.id, found.id);
      io.to(socketRoom(found.id)).emit('room:player:joined', player);
      broadcastRoomUpdated(io, found.id);
      sendRoomState(io, found.id);
      const clientRoom = maskedClientRoomForSocket(found.id, socket);
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
    const playerId = getPlayerId(socket);
    roomStore.setPlayerReady(roomId, playerId, true);
    io.to(socketRoom(roomId)).emit('room:player:ready', { playerId });
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:unready', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const playerId = getPlayerId(socket);
    roomStore.setPlayerReady(roomId, playerId, false);
    io.to(socketRoom(roomId)).emit('room:player:unready', { playerId });
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:kick', ({ targetId }) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId) return;

    // targetId = Player.id(token), 해당 소켓 찾기
    const targetSocketId = sessions.getSocketByToken(targetId) ?? targetId;
    const targetSocket = io.sockets.sockets.get(targetSocketId);

    const targetNickname = sessions.getNickname(targetSocketId);
    if (targetNickname) sessions.addKick(targetNickname, roomId);

    const kickResult = roomStore.removePlayer(roomId, targetId);
    sessions.clearRoom(targetSocketId);
    if (targetSocket) {
      targetSocket.leave(socketRoom(roomId));
      // 강퇴된 소켓을 LOBBY_ROOM으로 복귀
      targetSocket.join(LOBBY_ROOM);
      targetSocket.emit('lobby:rooms', roomStore.getAllSummaries());
      targetSocket.emit('kicked', { reason: '방장에 의해 퇴장되었습니다.' });
    }

    if (kickResult.destroyed) {
      sessions.clearRoomFromAllKicks(roomId);
      io.to(socketRoom(roomId)).emit('room:disbanded', {
        reason: '모든 플레이어가 나가 방이 종료되었습니다.',
      });
      broadcastRoomRemoved(io, roomId);
      return;
    }

    io.to(socketRoom(roomId)).emit('room:player:kicked', { playerId: targetId });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:delegate', ({ targetId }) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId) return;

    // targetId = Player.id(token)
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
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId) return;

    if (hasRoomStartCountdown(roomId)) return;

    const check = roomStore.canStart(roomId);
    if (!check.ok) {
      socket.emit('error', { message: check.reason ?? '시작할 수 없습니다.' });
      return;
    }

    let count = 3;
    const interval = setInterval(() => {
      io.to(socketRoom(roomId)).emit('room:countdown', { count });
      count--;
      if (count < 1) {
        clearRoomStartCountdown(roomId);
        const still = roomStore.get(roomId);
        if (still && still.status === 'waiting') {
          const recheck = roomStore.canStart(roomId);
          if (!recheck.ok) {
            socket.emit('error', { message: recheck.reason ?? '시작할 수 없습니다.' });
            return;
          }
          startGame(io, roomId);
        }
      }
    }, 1000);
    setRoomStartCountdown(roomId, interval);
  });

  socket.on('room:settings:update', (data, callback) => {
    const fail = (message: string) => {
      if (callback) callback({ success: false, error: message });
      else socket.emit('error', { message });
    };

    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return fail('방에 입장되어 있지 않습니다.');
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room) return fail('방을 찾을 수 없습니다.');
    if (room.hostId !== myId) return fail('방장만 설정을 변경할 수 있습니다.');

    if (room.status !== 'waiting') {
      return fail('게임 중에는 설정을 변경할 수 없습니다.');
    }
    if (room.isRanked) {
      return fail('랭크 방의 설정은 변경할 수 없습니다.');
    }

    // 방 제목 검증
    if (data.title !== undefined && (data.title.length < 1 || data.title.length > 30)) {
      return fail('방 제목은 1~30자로 입력해 주세요.');
    }

    if (
      data.playMode !== undefined &&
      !(['multi', 'com', 'solo'] as const).includes(data.playMode)
    ) {
      return fail('지원하지 않는 플레이 모드입니다.');
    }

    const targetPlayMode = data.playMode ?? room.playMode;
    const modeChanged = targetPlayMode !== room.playMode;

    // 게임 변경 검증
    let newGame: ReturnType<typeof getGameById> | undefined;
    if (data.gameId !== undefined && data.gameId !== room.gameId) {
      newGame = getGameById(data.gameId);
      if (!newGame) {
        return fail('게임을 찾을 수 없습니다.');
      }
    }

    const targetGame = newGame ?? getGameById(room.gameId);
    if (!targetGame) return fail('게임 정보를 찾을 수 없습니다.');
    if (!supportsPlayMode(targetGame, targetPlayMode)) {
      return fail('선택한 게임은 이 플레이 모드를 지원하지 않습니다.');
    }

    // 최대 인원 검증
    const resolvedMaxPlayers =
      targetPlayMode === 'com'
        ? 2
        : targetPlayMode === 'solo'
          ? 1
          : (data.maxPlayers ?? room.maxPlayers);
    if (targetPlayMode === 'multi') {
      if (
        !Number.isInteger(resolvedMaxPlayers) ||
        resolvedMaxPlayers < targetGame.minPlayers ||
        resolvedMaxPlayers > targetGame.maxPlayers
      ) {
        return fail('선택한 게임의 인원 범위를 벗어났습니다.');
      }
      const humanCount = room.players.filter((p) => p.id !== AI_PLAYER_ID).length;
      if (!modeChanged && resolvedMaxPlayers < humanCount) {
        return fail('현재 참여자 수보다 작게 설정할 수 없습니다.');
      }
    }

    // 비밀번호 검증
    const targetRoomType = targetPlayMode === 'solo' ? 'public' : (data.roomType ?? room.roomType);
    if (targetRoomType === 'private') {
      const hasExistingPassword =
        room.roomType === 'private' &&
        !data.clearPassword &&
        roomStore.getPassword(roomId) !== undefined;
      const hasValidNewPassword =
        data.password !== undefined && data.password.length >= 4 && data.password.length <= 8;
      if (data.password !== undefined && !hasValidNewPassword) {
        return fail('비밀번호는 4~8자리로 입력해 주세요.');
      }
      if (!hasExistingPassword && !hasValidNewPassword) {
        return fail('비밀번호는 4~8자리로 입력해 주세요.');
      }
    }

    // 시간제한은 멀티 모드에서만 사용한다. COM/솔로 전환 시에는 항상 제거한다.
    if (
      targetPlayMode === 'multi' &&
      data.timeLimitSeconds !== undefined &&
      data.timeLimitSeconds !== null
    ) {
      if (
        typeof data.timeLimitSeconds !== 'number' ||
        data.timeLimitSeconds < 10 ||
        data.timeLimitSeconds > 600
      ) {
        return fail('시간제한은 10초~10분 사이로 설정해 주세요.');
      }
    }

    const hadReadyPlayer = room.players.some(
      (player) => player.id !== AI_PLAYER_ID && player.id !== room.hostId && player.isReady,
    );

    const modeResult = modeChanged
      ? roomStore.changePlayMode(roomId, targetPlayMode, {
          minPlayers: targetGame.minPlayers,
          maxPlayers: resolvedMaxPlayers,
        })
      : null;
    if (modeChanged && !modeResult) {
      return fail('플레이 모드 변경에 실패했습니다.');
    }

    roomStore.updateSettings(roomId, {
      title: data.title,
      gameId: newGame?.id,
      gameName: newGame?.name,
      minPlayers: newGame?.minPlayers,
      maxPlayers: resolvedMaxPlayers,
      roomType: targetRoomType,
      password: targetRoomType === 'private' ? data.password : undefined,
      clearPassword: targetRoomType === 'public',
      timeLimitSeconds: targetPlayMode === 'multi' ? data.timeLimitSeconds : null,
      // 게임을 바꾸는 동시에 해당 게임의 상세 옵션을 보내는 경우에도 보존한다.
      gameOptions: data.gameOptions ?? (newGame ? {} : undefined),
    });
    roomStore.resetHumanReadiness(roomId);

    // 게임 변경 시 시스템 채팅 전송
    if (newGame) {
      emitRoomSystemMessage(io, roomId, `방장이 게임을 ${newGame.name}(으)로 변경했습니다.`);
    }
    if (modeChanged) {
      const modeLabel =
        targetPlayMode === 'multi' ? '멀티' : targetPlayMode === 'com' ? 'COM' : '1:1 솔로';
      emitRoomSystemMessage(io, roomId, `방장이 플레이 모드를 ${modeLabel}(으)로 변경했습니다.`);
    }
    if (modeResult?.aiLeft) {
      emitRoomSystemMessage(io, roomId, 'AI 님이 퇴장했습니다.');
    }
    if (modeResult?.aiJoined) {
      emitRoomSystemMessage(io, roomId, 'AI 님이 들어왔습니다.');
    }
    for (const movedPlayer of modeResult?.movedPlayers ?? []) {
      const nickname = isTokenAnonymized(roomId, movedPlayer.id)
        ? ANONYMOUS_NICKNAME
        : movedPlayer.nickname;
      emitRoomSystemMessage(io, roomId, `${nickname} 님이 관전자로 이동했습니다.`);
    }
    if (hadReadyPlayer) {
      emitRoomSystemMessage(io, roomId, '방 설정이 변경되어 준비 상태가 해제되었습니다.');
    }

    const updatedRoom = roomStore.getClientRoom(roomId);
    if (updatedRoom) {
      io.to(socketRoom(roomId)).emit('room:settings:updated', updatedRoom);
    }
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
    callback?.({ success: true });
  });

  socket.on('room:swap:colors', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId || room.status !== 'waiting') return;
    if (room.playMode === 'solo') return;
    roomStore.swapPlayers(roomId);
    sendRoomState(io, roomId);
  });

  socket.on('room:set:turn-order', ({ mode }) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId || room.status !== 'waiting') return;
    if (room.playMode === 'solo') return;

    if (mode === 'random') {
      roomStore.setTurnOrderMode(roomId, 'random');
    } else if (mode === 'first') {
      // 방장이 선공: 방장이 players[1]이면 스왑
      if (room.players.length === 2 && room.players[1]?.id === myId) {
        roomStore.swapPlayers(roomId);
      }
      roomStore.setTurnOrderMode(roomId, 'fixed');
    } else if (mode === 'second') {
      // 방장이 후공: 방장이 players[0]이면 스왑
      if (room.players.length === 2 && room.players[0]?.id === myId) {
        roomStore.swapPlayers(roomId);
      }
      roomStore.setTurnOrderMode(roomId, 'fixed');
    }

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
      if (isPasswordLockedOut(socket)) {
        return callback({
          success: false,
          error: '비밀번호를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.',
        });
      }
      const pw = roomStore.getPassword(roomId);
      if (pw && password !== pw) {
        recordPasswordFailure(socket);
        return callback({ success: false, error: '비밀번호가 틀렸습니다.' });
      }
      clearPasswordFailures(socket);
    }

    // 관전 잠금: 한 명이라도 관전 잠금을 사용한 방이면 일반 사용자는 관전 불가.
    // (단, 본인이 그 방의 player 인 경우 — 위에서 currentRoom 검사로 차단됨)
    if (isRoomSpectatorLocked(roomId)) {
      const myToken = sessions.getToken(socket.id);
      const isPlayerInRoom = myToken ? room.players.some((p) => p.id === myToken) : false;
      if (!isPlayerInRoom) {
        return callback({ success: false, error: '이 방은 관전이 잠긴 방입니다.' });
      }
    }

    const spectator = makePlayer(socket, false);
    roomStore.addSpectator(roomId, spectator);
    // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
    socket.join(socketRoom(roomId));
    sessions.setRoom(socket.id, roomId);

    const myToken = sessions.getToken(socket.id) ?? null;
    const clientRoom = roomStore.getClientRoom(roomId);
    const stateForSender =
      clientRoom && getRoomShopState(roomId)?.anonymizedTokens.size
        ? maskRoomForViewer(clientRoom, myToken)
        : clientRoom;
    callback({ success: true, room: stateForSender });
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

    const myId = getPlayerId(socket);
    if (room.hostId === myId) {
      return callback({ success: false, error: '방장은 관전자로 전환할 수 없습니다.' });
    }

    const moved = roomStore.moveToSpectator(roomId, myId);
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

    const myId = getPlayerId(socket);
    const moved = roomStore.moveToPlayer(roomId, myId);
    if (!moved) return callback({ success: false, error: '전환에 실패했습니다.' });

    callback({ success: true });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('game:leave', () => {
    handleLeaveRoom(io, socket);
  });
}

export function handleLeaveRoom(io: IO, socket: TypedSocket) {
  const roomId = sessions.getRoom(socket.id);
  if (!roomId) return;

  // 시스템 룸(이벤트 룸 등)은 일반 leave 흐름을 타지 않는다.
  // - 방 자체는 해체되지 않음 (영구 룸).
  // - 좌석/관전자 제거 및 핸드 중 자동 다이 처리는 eventRoom 매니저에 위임.
  if (roomStore.isSystemRoom(roomId)) {
    if (roomId === EVENT_SMS_ROOM_KEY) {
      smsEventRoom.leave(socket);
    } else if (roomId === EVENT_ROOM_KEY) {
      eventRoom.leave(socket);
    }
    socket.join(LOBBY_ROOM);
    const currentRooms = roomStore.getAllSummaries();
    socket.emit('lobby:rooms', currentRooms);
    broadcastOnlineUsers(io);
    return;
  }

  const playerId = getPlayerId(socket);
  const roomBefore = roomStore.get(roomId);
  const leavingWasHost = roomBefore?.hostId === playerId;
  const leavingNicknameRaw =
    roomBefore?.players.find((p: Player) => p.id === playerId)?.nickname ??
    roomBefore?.spectators.find((p: Player) => p.id === playerId)?.nickname ??
    sessions.getNickname(socket.id) ??
    '알 수 없음';
  const leavingNickname = isTokenAnonymized(roomId, playerId)
    ? ANONYMOUS_NICKNAME
    : leavingNicknameRaw;
  const spectatorsBefore: Player[] = roomBefore?.spectators ?? [];

  if (leavingWasHost) {
    clearRoomStartCountdown(roomId);
  }

  handleGameForfeit(io, roomId, playerId);

  const result = roomStore.removePlayer(roomId, playerId);
  sessions.clearRoom(socket.id);
  socket.leave(socketRoom(roomId));

  // 로비로 복귀: LOBBY_ROOM 재가입 + 초기 데이터 즉시 전송
  socket.join(LOBBY_ROOM);
  const currentRooms = roomStore.getAllSummaries();
  socket.emit('lobby:rooms', currentRooms);
  broadcastOnlineUsers(io);

  if (result.destroyed) {
    stopDummyAgent(roomId);
    clearAutoEnd(roomId);
    clearGameStartTime(roomId);
    io.to(socketRoom(roomId)).emit('room:disbanded', {
      reason: '모든 플레이어가 나가 방이 종료되었습니다.',
    });
    // 관전자들도 LOBBY_ROOM으로 복귀
    spectatorsBefore.forEach((s) => {
      const specSocketId = sessions.getSocketByToken(s.id) ?? s.id;
      sessions.clearRoom(specSocketId);
      const specSocket = io.sockets.sockets.get(specSocketId);
      if (specSocket) {
        specSocket.join(LOBBY_ROOM);
        specSocket.emit('lobby:rooms', currentRooms);
      }
    });
    sessions.clearRoomFromAllKicks(roomId);
    cleanupRoomShopState(roomId);
    broadcastRoomRemoved(io, roomId);
    return;
  }

  destroyOrphanedDummyRoom(io, roomId);

  if (result.newHostId) {
    io.to(socketRoom(roomId)).emit('room:host:changed', { newHostId: result.newHostId });
  }

  io.to(socketRoom(roomId)).emit('room:player:left', {
    playerId,
    nickname: leavingNickname,
    newHostId: result.newHostId,
  });

  sendRoomState(io, roomId);
  broadcastRoomUpdated(io, roomId);
}
