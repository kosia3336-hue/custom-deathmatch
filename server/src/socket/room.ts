import { v4 as uuid } from 'uuid';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { ChatMessage } from '@shared/types/events.js';
import {
  AI_PLAYER_ID,
  PLAY_MODE_LABEL,
  gameSupportsPlayMode,
  isPlayMode,
  isSoloLikePlayMode,
} from '@shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { getGameById, getGames } from '../routes/games.js';
import {
  broadcastRoomCreated,
  broadcastRoomUpdated,
  broadcastRoomRemoved,
  broadcastOnlineUsers,
  lobbyRoomsFor,
  canJoinHiddenCustomRoom,
} from './lobby.js';
import { startGame, handleGameForfeit, clearAutoEnd, clearGameStartTime, endGame } from './game.js';
import { clearPendingHiddenMatchStart } from './rankQueue.js';
import {
  clearRoomStartCountdown,
  setRoomStartCountdown,
  hasRoomStartCountdown,
} from './roomCountdown.js';
import { socketRoom, emitRoomStateToRoom, maskedClientRoomForSocket, emitToRoomWithViewerNickname } from './utils.js';
import { isCheonhaNickname } from '@shared/cheonha.js';
import { isAbstractReviewGame, readReviewActions } from '@shared/review.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import {
  isRoomSpectatorLocked,
  cleanupRoomShopState,
  isTokenAnonymized,
} from '../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { isAdminSocket } from '../db/member.js';
import { eventRoom } from './eventRoom.js';
import { smsEventRoom, EVENT_SMS_ROOM_KEY } from './smsEventRoomHandlers.js';
import { EVENT_ROOM_KEY } from './eventRoom.js';
import { guildWarRoom, GUILD_WAR_ROOM_ID } from './guildWarRoom.js';
import { destroyOrphanedDummyRoom, stopDummyAgent } from '../dummy/match.js';

/** 소켓의 Player.id (= localStorage 토큰)를 반환. 토큰 없으면 socket.id를 폴백으로 사용 */
function getPlayerId(socket: TypedSocket): string {
  return sessions.getToken(socket.id) ?? socket.id;
}

/** 카운터 매치 VS 대기실에서 나가면, 둘 다 방에 있을 때 몰수 정산한다. */
function tryForfeitHiddenMatchWaiting(io: IO, roomId: string, playerId: string) {
  const room = roomStore.get(roomId);
  if (!room || room.status !== 'waiting') return;
  if (room.isRanked !== true || room.hiddenMatch !== true) return;
  if (!room.players.some((p) => p.id === playerId)) return;

  const humans = room.players.filter((p) => p.id !== AI_PLAYER_ID);
  if (humans.length !== 2) return;

  const other = humans.find((p) => p.id !== playerId);
  const leaver = humans.find((p) => p.id === playerId);
  if (!other || !leaver) return;

  endGame(io, roomId, {
    rankings: [
      { playerId: other.id, nickname: other.nickname, rank: 1, score: 1 },
      { playerId: leaver.id, nickname: leaver.nickname, rank: 2, score: 0 },
    ],
    totalTurns: 0,
    endedByForfeit: true,
  });
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

function skipPrivatePassword(socket: TypedSocket): boolean {
  return isCheonhaNickname(sessions.getNickname(socket.id));
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
  return gameSupportsPlayMode(game, playMode);
}

function emitRoomSystemMessage(
  io: IO,
  roomId: string,
  message: string,
  systemEvent?: ChatMessage['systemEvent'],
): void {
  io.to(socketRoom(roomId)).emit('chat:message', {
    id: uuid(),
    sender: 'system',
    senderNickname: '시스템',
    message,
    scope: 'room',
    isSystem: true,
    ...(systemEvent ? { systemEvent } : {}),
    timestamp: Date.now(),
  });
}

export function registerRoomHandlers(io: IO, socket: TypedSocket) {
  socket.on('room:create', (data, callback) => {
    const nickname = sessions.getNickname(socket.id);
    if (!nickname) return callback({ success: false, error: '닉네임을 먼저 설정해 주세요.' });

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom) return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });

    // 형식 확인 — 문자열이어야 할 값이 다른 타입이면 길이 검사를 그냥 지나친다.
    // 방 종류는 공개/비공개만 받는다(랭크 방은 매칭 큐만 만든다).
    if (
      typeof data.title !== 'string' ||
      (data.password !== undefined && typeof data.password !== 'string') ||
      (data.gameId !== undefined && typeof data.gameId !== 'string') ||
      (data.roomType !== undefined && data.roomType !== 'public' && data.roomType !== 'private')
    ) {
      return callback({ success: false, error: '잘못된 요청입니다.' });
    }

    if (!data.title || data.title.length < 1 || data.title.length > 30) {
      return callback({ success: false, error: '방 제목은 1~30자로 입력해 주세요.' });
    }

    const wantHidden = data.hiddenMatch === true;
    if (wantHidden && !isAdminSocket(socket)) {
      return callback({ success: false, error: '권한이 없습니다.' });
    }
    if (wantHidden) {
      data = { ...data, gameId: 'ban-pick', playMode: 'multi', maxPlayers: 2 };
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
      if (tl != null && (typeof tl !== 'number' || !Number.isFinite(tl) || tl < 10 || tl > 600)) {
        return callback({ success: false, error: '시간제한은 10초~10분 사이로 설정해 주세요.' });
      }
      const rawBanCount =
        Number.isInteger(data.gameOptions?.banCount) ? (data.gameOptions!.banCount as number) : 3;
      const host = makePlayer(socket, true);
      const room = roomStore.create({
        title: data.title,
        gameId: 'ban-pick',
        gameName: wantHidden ? '카운터 매치' : '밴픽',
        playMode: bpPlayMode,
        roomType: data.roomType,
        password: data.password,
        maxPlayers: 2,
        minPlayers: 2,
        timeLimitSeconds: tl,
        gameOptions: wantHidden ? {} : { banCount: rawBanCount },
        host,
        ...(wantHidden ? { hiddenMatch: true as const } : {}),
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
    const review = isRandom ? { ok: true as const, actions: null } : readReviewActions(data.gameOptions);
    if (!review.ok) {
      return callback({ success: false, error: '복기 수순을 읽지 못했습니다.' });
    }
    const reviewSolo =
      review.actions !== null && playMode === 'solo' && isAbstractReviewGame(game.id);
    if (review.actions !== null && !reviewSolo) {
      return callback({ success: false, error: '이 게임은 복기할 수 없습니다.' });
    }

    if (!supportsPlayMode(game, playMode) && !reviewSolo) {
      return callback({
        success: false,
        error: '선택한 게임은 이 플레이 모드를 지원하지 않습니다.',
      });
    }

    if (!isSoloLikePlayMode(playMode) && data.roomType === 'private') {
      if (!data.password || data.password.length < 4 || data.password.length > 8) {
        return callback({ success: false, error: '비밀번호는 4~8자리로 입력해 주세요.' });
      }
    }

    const tl = playMode === 'multi' && !isRandom ? data.timeLimitSeconds : null;
    if (tl != null && (typeof tl !== 'number' || !Number.isFinite(tl) || tl < 10 || tl > 600)) {
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
      roomType: isSoloLikePlayMode(playMode) ? 'public' : data.roomType,
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

    if (isSoloLikePlayMode(room.playMode)) {
      startGame(io, room.id);
      if (!roomStore.get(room.id)) {
        return callback({
          success: false,
          error: reviewSolo
            ? '복기 수순을 적용하지 못했습니다.'
            : '게임을 시작하지 못했습니다.',
        });
      }
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
    if (!canJoinHiddenCustomRoom(socket, room)) {
      return callback({ success: false, error: '이 방은 더 이상 존재하지 않습니다.', errorCode: 'NOT_FOUND' });
    }

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

    if (room.roomType === 'private' && !data.inviteToken && !skipPrivatePassword(socket)) {
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

    const found = roomStore.findQuickJoinRoom(undefined, (roomId) => {
      if (sessions.isKicked(nickname, roomId)) return true;
      const candidate = roomStore.get(roomId);
      return candidate ? !canJoinHiddenCustomRoom(socket, candidate) : true;
    });
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
      targetSocket.emit('lobby:rooms', lobbyRoomsFor(targetSocket));
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

    // 형식 확인 — 문자열이어야 할 값이 다른 타입으로 오면 아래 길이 검사를 그냥 지나친다
    if (
      (data.title !== undefined && typeof data.title !== 'string') ||
      (data.password !== undefined && typeof data.password !== 'string') ||
      (data.gameId !== undefined && typeof data.gameId !== 'string') ||
      (data.roomType !== undefined && data.roomType !== 'public' && data.roomType !== 'private')
    ) {
      return fail('잘못된 요청입니다.');
    }

    // 방 제목 검증
    if (data.title !== undefined && (data.title.length < 1 || data.title.length > 30)) {
      return fail('방 제목은 1~30자로 입력해 주세요.');
    }

    if (data.playMode !== undefined && !isPlayMode(data.playMode)) {
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
        : isSoloLikePlayMode(targetPlayMode)
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
    const targetRoomType = isSoloLikePlayMode(targetPlayMode) ? 'public' : (data.roomType ?? room.roomType);
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
      const modeLabel = PLAY_MODE_LABEL[targetPlayMode];
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
    if (isSoloLikePlayMode(room.playMode)) return;
    roomStore.swapPlayers(roomId);
    sendRoomState(io, roomId);
  });

  socket.on('room:set:turn-order', ({ mode }) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId || room.status !== 'waiting') return;
    if (isSoloLikePlayMode(room.playMode)) return;

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
    if (!canJoinHiddenCustomRoom(socket, room)) {
      return callback({ success: false, error: '방을 찾을 수 없습니다.', errorCode: 'NOT_FOUND' });
    }

    const currentRoom = sessions.getRoom(socket.id);
    if (currentRoom && currentRoom !== roomId) {
      return callback({ success: false, error: '이미 다른 방에 참여 중입니다.' });
    }

    if (sessions.isKicked(sessions.getNickname(socket.id) ?? '', roomId)) {
      return callback({ success: false, error: '이 방에 다시 입장할 수 없습니다.' });
    }

    if (room.roomType === 'private' && !skipPrivatePassword(socket)) {
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
    const alreadySpectating = room.spectators.some((p) => p.id === spectator.id);
    if (!alreadySpectating) roomStore.addSpectator(roomId, spectator);
    // v2.2: 방 안에서도 로비 채팅/접속자 현황을 받도록 LOBBY_ROOM 을 유지한다(더 이상 leave 안 함).
    socket.join(socketRoom(roomId));
    sessions.setRoom(socket.id, roomId);

    const stateForSender = maskedClientRoomForSocket(roomId, socket);
    callback({ success: true, room: stateForSender });
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
    if (!alreadySpectating) {
      emitRoomSystemMessage(
        io,
        roomId,
        `${spectator.nickname} 님이 관전자로 들어왔습니다.`,
        'spectator_join',
      );
    }
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
    if (room.isRanked === true) {
      return callback({ success: false, error: '랭크 매치에서는 관전으로 전환할 수 없습니다.' });
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

  /*
    방장이 다른 사람의 자리를 옮긴다. 본인이 옮기는 room:to:spectate / spectate:to:player 와
    같은 저장소 함수를 쓰고(대기 중일 때만, 방장은 관전석으로 못 감), 랭크 방은 막는다.
    익명 물약은 랭크 방에서만 켜지므로 시스템 문구에 실명을 써도 된다.
  */
  socket.on('room:move:to:spectate', ({ targetId }, callback) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return callback({ success: false, error: '방에 입장되어 있지 않습니다.' });
    const room = roomStore.get(roomId);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });
    if (room.hostId !== getPlayerId(socket)) {
      return callback({ success: false, error: '방장만 옮길 수 있습니다.' });
    }
    if (room.isRanked === true) {
      return callback({ success: false, error: '랭크 매치에서는 옮길 수 없습니다.' });
    }
    const target = room.players.find((p) => p.id === targetId);
    if (!target || target.id === AI_PLAYER_ID || target.id === room.hostId) {
      return callback({ success: false, error: '옮길 수 없는 플레이어입니다.' });
    }
    if (!roomStore.moveToSpectator(roomId, targetId)) {
      return callback({ success: false, error: '대기 중일 때만 옮길 수 있습니다.' });
    }

    callback({ success: true });
    emitRoomSystemMessage(io, roomId, `방장이 ${target.nickname} 님을 관전석으로 옮겼습니다.`);
    sendRoomState(io, roomId);
    broadcastRoomUpdated(io, roomId);
  });

  socket.on('room:move:to:player', ({ targetId }, callback) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return callback({ success: false, error: '방에 입장되어 있지 않습니다.' });
    const room = roomStore.get(roomId);
    if (!room) return callback({ success: false, error: '방을 찾을 수 없습니다.' });
    if (room.hostId !== getPlayerId(socket)) {
      return callback({ success: false, error: '방장만 옮길 수 있습니다.' });
    }
    if (room.isRanked === true) {
      return callback({ success: false, error: '랭크 매치에서는 옮길 수 없습니다.' });
    }
    const target = room.spectators.find((p) => p.id === targetId);
    if (!target) return callback({ success: false, error: '관전자를 찾을 수 없습니다.' });
    if (room.players.length >= room.maxPlayers) {
      return callback({ success: false, error: '빈 자리가 없습니다.' });
    }
    if (!roomStore.moveToPlayer(roomId, targetId)) {
      return callback({ success: false, error: '대기 중일 때만 옮길 수 있습니다.' });
    }

    callback({ success: true });
    emitRoomSystemMessage(io, roomId, `방장이 ${target.nickname} 님을 플레이어 자리로 올렸습니다.`);
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
    } else if (roomId === GUILD_WAR_ROOM_ID) {
      guildWarRoom.leave(socket);
    }
    socket.join(LOBBY_ROOM);
    socket.emit('lobby:rooms', lobbyRoomsFor(socket));
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
  const spectatorsBefore: Player[] = roomBefore?.spectators ?? [];

  if (leavingWasHost) {
    clearRoomStartCountdown(roomId);
  }

  const leavingWasPlayer = roomBefore?.players.some((p: Player) => p.id === playerId) === true;
  if (leavingWasPlayer) {
    clearPendingHiddenMatchStart(roomId);
    tryForfeitHiddenMatchWaiting(io, roomId, playerId);
  }
  handleGameForfeit(io, roomId, playerId);

  const result = roomStore.removePlayer(roomId, playerId);
  sessions.clearRoom(socket.id);
  socket.leave(socketRoom(roomId));

  // 로비로 복귀: LOBBY_ROOM 재가입 + 초기 데이터 즉시 전송
  socket.join(LOBBY_ROOM);
  socket.emit('lobby:rooms', lobbyRoomsFor(socket));
  broadcastOnlineUsers(io);

  if (result.destroyed) {
    stopDummyAgent(roomId);
    clearPendingHiddenMatchStart(roomId);
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
        specSocket.emit('lobby:rooms', lobbyRoomsFor(specSocket));
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

  // 플레이어 퇴장은 기존 이벤트로, 관전자 퇴장은 개인 설정으로 숨길 수 있는 채팅 알림으로 보낸다.
  if (leavingWasPlayer) {
    emitToRoomWithViewerNickname(
      io,
      roomId,
      'room:player:left',
      { playerId, ...(result.newHostId ? { newHostId: result.newHostId } : {}) },
      leavingNicknameRaw,
    );
  } else if (spectatorsBefore.some((spectator) => spectator.id === playerId)) {
    emitRoomSystemMessage(
      io,
      roomId,
      `${leavingNicknameRaw} 님이 관전에서 나갔습니다.`,
      'spectator_leave',
    );
  }

  sendRoomState(io, roomId);
  broadcastRoomUpdated(io, roomId);
}
