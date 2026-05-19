import type { RankQueueEntry } from '../store/rankQueue.js';
import { rankQueueStore } from '../store/rankQueue.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { ensureRankStatsRow } from '../db/rankStats.js';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '../rank/kst.js';
import { startGame } from './game.js';
import { socketRoom, emitRoomStateToRoom } from './utils.js';
import type { Player } from '@shared/types/room.js';
import type { IO, TypedSocket } from './types.js';
import { applyAutoConsumablesForRankRoom } from '../shop/applyAutoConsumables.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';

let retryTimer: ReturnType<typeof setInterval> | null = null;

function startRetryTimer(io: IO) {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    const pairs = rankQueueStore.attemptAllMatches();
    for (const { host, guest } of pairs) {
      console.log(`[rankQueue] retry matched: ${host.nickname} vs ${guest.nickname}`);
      void createRankMatchedRoom(io, host, guest, host.seasonId).catch((err) => {
        console.warn('[rankQueue] createRankMatchedRoom 실패:', (err as Error).message);
      });
    }
  }, 5_000);
}

function buildPlayer(socketId: string, isHost: boolean): Player | null {
  const nickname = sessions.getNickname(socketId);
  const token = sessions.getToken(socketId);
  if (!nickname || !token) return null;
  return {
    id: token,
    nickname,
    isHost,
    isReady: !isHost,
    joinedAt: Date.now(),
    memberId: sessions.getMemberId(token),
    displayedTitle: sessions.getDisplayedTitle(token),
  };
}

export async function createRankMatchedRoom(
  io: IO,
  hostEntry: RankQueueEntry,
  guestEntry: RankQueueEntry,
  seasonId: number,
): Promise<void> {
  const hostPlayer = buildPlayer(hostEntry.socketId, true);
  const guestPlayer = buildPlayer(guestEntry.socketId, false);
  if (!hostPlayer?.memberId || !guestPlayer?.memberId) return;

  const room = roomStore.create({
    title: `[랭크] ${hostPlayer.nickname} vs ${guestPlayer.nickname}`,
    gameId: 'ban-pick',
    gameName: '밴픽',
    playMode: 'multi',
    roomType: 'rank',
    maxPlayers: 2,
    minPlayers: 2,
    timeLimitSeconds: 180,
    gameOptions: { banCount: 3, banTurnSeconds: 30 },
    turnOrderMode: 'random',
    host: hostPlayer,
    isRanked: true,
    rankSeasonId: seasonId,
    spectatorAllowed: true,
  });

  if (!roomStore.addPlayer(room.id, guestPlayer)) {
    roomStore.delete(room.id);
    return;
  }

  const hostSock = io.sockets.sockets.get(hostEntry.socketId);
  const guestSock = io.sockets.sockets.get(guestEntry.socketId);
  if (!hostSock || !guestSock) {
    roomStore.delete(room.id);
    return;
  }

  // 큐 대기 중 관전방에 들어갔다면, 이전 소켓 채널을 떠나고 spectator 목록도 정리
  for (const { sock, socketId } of [
    { sock: hostSock, socketId: hostEntry.socketId },
    { sock: guestSock, socketId: guestEntry.socketId },
  ]) {
    const prevRoomId = sessions.getRoom(socketId);
    if (prevRoomId) {
      sock.leave(socketRoom(prevRoomId));
      const token = sessions.getToken(socketId);
      if (token) {
        roomStore.removePlayer(prevRoomId, token);
        const prevClientRoom = roomStore.getClientRoom(prevRoomId);
        if (prevClientRoom) io.to(socketRoom(prevRoomId)).emit('room:state', prevClientRoom);
      }
    }
  }

  hostSock.join(socketRoom(room.id));
  guestSock.join(socketRoom(room.id));
  sessions.setRoom(hostEntry.socketId, room.id);
  sessions.setRoom(guestEntry.socketId, room.id);

  // ── 자동 소모성 사용 (관전 잠금 / 익명물약) + bias 캐시 채우기 ─────
  // startGame 보다 먼저 호출해야 ban-pick 가중치 추첨에서 bias 가 반영된다.
  try {
    await applyAutoConsumablesForRankRoom(io, room.id, [hostPlayer, guestPlayer]);
  } catch (err) {
    console.warn('[rankQueue] applyAutoConsumablesForRankRoom 실패:', (err as Error).message);
  }

  // 익명 물약 적용 후 방 제목에 닉네임 마스킹 반영
  const shopStateForTitle = getRoomShopState(room.id);
  const anonForTitle = shopStateForTitle?.anonymizedTokens ?? new Set<string>();
  const hostNickForTitle = anonForTitle.has(hostPlayer.id) ? ANONYMOUS_NICKNAME : hostPlayer.nickname;
  const guestNickForTitle = anonForTitle.has(guestPlayer.id) ? ANONYMOUS_NICKNAME : guestPlayer.nickname;
  roomStore.updateSettings(room.id, { title: `[랭크] ${hostNickForTitle} vs ${guestNickForTitle}` });

  // 마스킹은 emitRoomStateToRoom 헬퍼에서 player 별로 처리.
  emitRoomStateToRoom(io, room.id);

  // 매칭 모달용 — 본인 *외* 의 anonymity 적용 마스킹.
  const shopState = getRoomShopState(room.id);
  const anon = shopState?.anonymizedTokens ?? new Set<string>();

  const guestForHost = anon.has(guestPlayer.id)
    ? { nickname: ANONYMOUS_NICKNAME, title: null as null }
    : { nickname: guestPlayer.nickname, title: guestPlayer.displayedTitle ?? null };
  const hostForGuest = anon.has(hostPlayer.id)
    ? { nickname: ANONYMOUS_NICKNAME, title: null as null }
    : { nickname: hostPlayer.nickname, title: hostPlayer.displayedTitle ?? null };

  const guestIsAnon = anon.has(guestPlayer.id);
  const hostIsAnon = anon.has(hostPlayer.id);

  hostSock.emit('rank:queue:matched', {
    roomId: room.id,
    opponentNickname: guestForHost.nickname,
    opponentDisplayedTitle: guestForHost.title,
    opponentTier: guestIsAnon ? null : guestEntry.tier,
    opponentRp: guestIsAnon ? null : guestEntry.rp,
    opponentIsPlacement: guestIsAnon ? null : !guestEntry.placementDone,
    selfTier: hostEntry.tier,
    selfRp: hostEntry.rp,
    selfIsPlacement: !hostEntry.placementDone,
  });
  guestSock.emit('rank:queue:matched', {
    roomId: room.id,
    opponentNickname: hostForGuest.nickname,
    opponentDisplayedTitle: hostForGuest.title,
    opponentTier: hostIsAnon ? null : hostEntry.tier,
    opponentRp: hostIsAnon ? null : hostEntry.rp,
    opponentIsPlacement: hostIsAnon ? null : !hostEntry.placementDone,
    selfTier: guestEntry.tier,
    selfRp: guestEntry.rp,
    selfIsPlacement: !guestEntry.placementDone,
  });

  startGame(io, room.id);
}

export function registerRankQueueHandlers(io: IO, socket: TypedSocket): void {
  socket.on('rank:queue:join', async (callback) => {
    if (typeof callback !== 'function') return;

    const member = (socket.data as { member?: { id: string } }).member;
    console.log(`[rankQueue:join] socket=${socket.id} memberId=${member?.id ?? 'NONE'} inRoom=${sessions.getRoom(socket.id) ?? 'none'}`);

    if (!member?.id) {
      callback({ success: false, error: '회원 로그인이 필요합니다.' });
      return;
    }

    if (!isRankQueueOpen()) {
      callback({
        success: false,
        error: '랭크 운영 시간이 아닙니다. (평일 21:00~익일 01:00 KST / 주말 24시간)',
      });
      return;
    }

    if (!isRankQueueAcceptingNewJoins()) {
      callback({
        success: false,
        error: '랭크 운영 종료 1분 전입니다. 새 매칭을 시작할 수 없습니다.',
      });
      return;
    }

    if (sessions.getRoom(socket.id)) {
      console.log(`[rankQueue:join] BLOCKED — already in room ${sessions.getRoom(socket.id)}`);
      callback({ success: false, error: '이미 방에 참여 중입니다.' });
      return;
    }

    const row = await ensureRankStatsRow(member.id);
    if (!row.ok) {
      console.log(`[rankQueue:join] BLOCKED — ensureRankStatsRow failed: ${row.error}`);
      callback({ success: false, error: row.error });
      return;
    }

    const nickname = sessions.getNickname(socket.id);
    if (!nickname) {
      console.log(`[rankQueue:join] BLOCKED — no nickname for socket ${socket.id}`);
      callback({ success: false, error: '닉네임을 확인할 수 없습니다.' });
      return;
    }

    const token = sessions.getToken(socket.id);
    const displayedTitle = token ? sessions.getDisplayedTitle(token) : null;

    const entry: RankQueueEntry = {
      socketId: socket.id,
      memberId: member.id,
      nickname,
      displayedTitle,
      tier: row.stats.tier,
      rp: row.stats.rp,
      placementDone: row.stats.placement_done,
      winStreak: row.stats.win_streak,
      lossStreak: row.stats.loss_streak,
      joinedAt: Date.now(),
      seasonId: row.seasonId,
    };

    const res = rankQueueStore.enqueue(entry);
    if (!res.matched) {
      startRetryTimer(io);
      socket.emit('rank:queue:status', {
        inQueue: true,
        waitSeconds: rankQueueStore.waitSeconds(member.id),
      });
      callback({ success: true });
      return;
    }

    void createRankMatchedRoom(io, res.host, res.guest, row.seasonId).catch((err) => {
      console.warn('[rankQueue] createRankMatchedRoom 실패:', (err as Error).message);
    });
    callback({ success: true });
  });

  socket.on('rank:queue:leave', () => {
    rankQueueStore.removeBySocket(socket.id);
    socket.emit('rank:queue:status', { inQueue: false, waitSeconds: 0 });
  });
}
