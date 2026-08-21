import { v4 as uuid } from 'uuid';
import { GAME_IDS } from '@shared/types/game.js';
import type { DummyAiTier } from '@shared/dummy.js';
import { makeDummyPlayerId } from '@shared/dummy.js';
import type { Player } from '@shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { getGameById } from '../routes/games.js';
import { startGame } from '../socket/game.js';
import { socketRoom, emitRoomStateToRoom } from '../socket/utils.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { startDummyAgent, destroyOrphanedDummyRoom, stopDummyAgent } from './agent.js';

export { destroyOrphanedDummyRoom, stopDummyAgent };

function dummyNickname(): string {
  const base = '연습상대';
  if (!sessions.isNicknameTaken(base)) return base;
  return `${base}·${uuid().slice(0, 4)}`;
}

function buildHostPlayer(socket: TypedSocket): Player | null {
  const nickname = sessions.getNickname(socket.id);
  const token = sessions.getToken(socket.id);
  if (!nickname || !token) return null;
  return {
    id: token,
    nickname,
    isHost: true,
    isReady: true,
    joinedAt: Date.now(),
    memberId: sessions.getMemberId(token),
    displayedTitle: sessions.getDisplayedTitle(token),
    equippedSkins: sessions.getEquippedSkins(token),
  };
}

export function createDevDummyMatch(
  io: IO,
  socket: TypedSocket,
  opts: { tier: DummyAiTier; skipGameId?: string },
): { ok: true; roomId: string } | { ok: false; error: string } {
  const member = (socket.data as { member?: { id: string } }).member;
  if (!member?.id) {
    return { ok: false, error: '로그인이 필요합니다.' };
  }

  const host = buildHostPlayer(socket);
  if (!host) {
    return { ok: false, error: '소켓 세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.' };
  }

  const alreadyRoom = sessions.getRoom(socket.id);
  if (alreadyRoom) {
    return { ok: false, error: '이미 다른 방에 있습니다. 나온 뒤 다시 시작하세요.' };
  }
  if (roomStore.findByMemberId(member.id)) {
    return { ok: false, error: '이미 다른 방에 있습니다. 나온 뒤 다시 시작하세요.' };
  }

  const dummyId = makeDummyPlayerId();
  const nick = dummyNickname();
  sessions.linkToken(dummyId, dummyId);
  sessions.setNickname(dummyId, nick, true);

  const dummy: Player = {
    id: dummyId,
    nickname: nick,
    isHost: false,
    isReady: true,
    joinedAt: Date.now(),
    memberId: null,
  };

  const skipId = opts.skipGameId;
  if (
    skipId
    && skipId !== GAME_IDS.FOUR_GRAVITY
    && skipId !== GAME_IDS.DOUBLE_SIDED_CHESS
    && skipId !== GAME_IDS.NUMBER_FOUR
    && skipId !== GAME_IDS.INDIAN_POKER
    && skipId !== GAME_IDS.INVEST_DONATE
    && skipId !== GAME_IDS.BETTING_RPS
    && skipId !== GAME_IDS.MULTIPLE_BNW
    && skipId !== GAME_IDS.WINNING_STREAK
    && skipId !== GAME_IDS.BNW2
    && skipId !== GAME_IDS.SILPER_BNW
    && skipId !== GAME_IDS.FIVE_TOWERS
    && skipId !== GAME_IDS.GRAPE_SUGAR_2
    && skipId !== GAME_IDS.SUN_MOON_STAR_2
    && skipId !== GAME_IDS.BANK_GAME
    && skipId !== GAME_IDS.QUATRO
  ) {
    return { ok: false, error: '바로 시작할 수 있는 게임은 사목·양면장기·넘버4·인디언홀덤Q·투자와기부·베팅가위바위보·배수흑과백·연승게임·흑과백2·실퍼의흑과백·5개의탑·포도설탕2·해달별2·은행놀이·콰트로뿐입니다.' };
  }

  const skipGame = skipId ? getGameById(skipId) : null;
  const gameId = skipId ?? GAME_IDS.BAN_PICK;
  const gameName = skipId ? (skipGame?.name ?? skipId) : '밴픽';

  const room = roomStore.create({
    title: `[DEV 더미] ${host.nickname} vs ${nick}`,
    gameId,
    gameName,
    playMode: 'multi',
    roomType: 'private',
    maxPlayers: 2,
    minPlayers: 2,
    timeLimitSeconds: 180,
    gameOptions: skipId
      ? { devDummy: true }
      : { banCount: 3, banTurnSeconds: 30, rankingActiveOnly: true, devDummy: true },
    turnOrderMode: 'random',
    host,
    isRanked: false,
    spectatorAllowed: true,
  });

  if (!roomStore.addPlayer(room.id, dummy)) {
    roomStore.delete(room.id);
    sessions.removeSession(dummyId);
    return { ok: false, error: '방을 만들지 못했습니다.' };
  }

  socket.join(socketRoom(room.id));
  sessions.setRoom(socket.id, room.id);
  sessions.setRoom(dummyId, room.id);

  emitRoomStateToRoom(io, room.id);
  startGame(io, room.id);
  startDummyAgent(io, room.id, dummyId, opts.tier);
  console.log(
    `[devDummy] room=${room.id} game=${gameId} tier=${opts.tier} dummy=${dummyId} skipGameId=${skipId ?? 'banpick'}`,
  );

  return { ok: true, roomId: room.id };
}
