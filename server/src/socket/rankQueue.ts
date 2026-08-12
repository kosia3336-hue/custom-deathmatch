import type { RankQueueEntry } from '../store/rankQueue.js';
import { rankQueueStore } from '../store/rankQueue.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { ensureRankStatsRow } from '../db/rankStats.js';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '../rank/kst.js';
import { startGame } from './game.js';
import { socketRoom, emitRoomStateToRoom } from './utils.js';
import type { Player, DisplayedTitle } from '@shared/types/room.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import type { IO, TypedSocket } from './types.js';
import { applyAutoConsumablesForRankRoom } from '../shop/applyAutoConsumables.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';

let retryTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 처리 중인 join 을 회원 단위로 잠근다.
 *
 * rank:queue:join 은 enqueue 전에 ensureRankStatsRow 로 DB 를 한 번 다녀온다.
 * 그 사이에 같은 사람의 join 이 또 들어오면(버튼 연타, connect 재참가와 겹침 등)
 * 두 요청이 나란히 enqueue 까지 내려간다. 먼저 온 쪽이 이미 매칭돼 큐에서 빠진
 * 뒤라면, 나중 쪽이 같은 사람을 큐에 다시 넣고 또 다른 상대와 매칭시킨다.
 * → 한 사람이 랭크 방 두 개에 동시에 들어가는 사고가 난다(실제 발생).
 */
const joinInFlight = new Set<string>();

/** 이 회원이 이미 어떤 방에든 들어가 있는가 (소켓이 여러 개일 수 있어 회원 단위로 본다) */
function isMemberInAnyRoom(memberId: string): boolean {
  return roomStore
    .getAll()
    .some((r) => r.players.some((p) => p.memberId === memberId));
}

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
    guildMark: sessions.getGuildMark(token),
    equippedSkins: sessions.getEquippedSkins(token),
  };
}

/** DB 에서 최신 표시 칭호를 읽는다 — 소켓 세션 캐시가 오래됐을 수 있어 매칭 시점에 갱신 */
async function fetchFreshDisplayedTitle(memberId: string): Promise<DisplayedTitle | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getSupabaseAdmin();
    const { data: m } = await sb
      .from('members')
      .select('displayed_title_id')
      .eq('id', memberId)
      .maybeSingle();
    const titleId = (m as { displayed_title_id?: string | null } | null)?.displayed_title_id;
    if (!titleId) return null;
    const { data: t } = await sb
      .from('titles')
      .select('id, name, color, effect')
      .eq('id', titleId)
      .maybeSingle();
    return (t as DisplayedTitle | null) ?? null;
  } catch {
    return null;
  }
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

  // 큐에서 빠진 뒤 방을 만들기까지 사이에 상대가 이미 다른 방에 들어갔을 수 있다.
  // 그대로 진행하면 그 사람을 원래 방에서 끌어내 두 방이 동시에 망가진다.
  // 한쪽만 문제라면 멀쩡한 쪽은 큐로 돌려보내 다음 상대를 찾게 한다.
  const hostBusy = isMemberInAnyRoom(hostPlayer.memberId);
  const guestBusy = isMemberInAnyRoom(guestPlayer.memberId);
  if (hostBusy || guestBusy) {
    console.warn(
      `[rankQueue] 매칭 취소 — 이미 방에 있는 참가자: `
      + `${hostBusy ? hostEntry.nickname : ''}${hostBusy && guestBusy ? ', ' : ''}${guestBusy ? guestEntry.nickname : ''}`,
    );
    if (!hostBusy) rankQueueStore.enqueue(hostEntry);
    if (!guestBusy) rankQueueStore.enqueue(guestEntry);
    return;
  }

  // 표시 칭호를 DB 기준으로 갱신 — 웹에서 칭호 변경 후 소켓 세션이 낡은 값을 들고 있는 문제 방지
  const [hostTitle, guestTitle] = await Promise.all([
    fetchFreshDisplayedTitle(hostPlayer.memberId),
    fetchFreshDisplayedTitle(guestPlayer.memberId),
  ]);
  hostPlayer.displayedTitle = hostTitle;
  guestPlayer.displayedTitle = guestTitle;
  sessions.setMemberInfo(hostPlayer.id, hostPlayer.memberId, hostTitle, sessions.getEquippedSkins(hostPlayer.id), sessions.getGuildMark(hostPlayer.id), sessions.getGuildId(hostPlayer.id), sessions.getGuildName(hostPlayer.id));
  sessions.setMemberInfo(guestPlayer.id, guestPlayer.memberId, guestTitle, sessions.getEquippedSkins(guestPlayer.id), sessions.getGuildMark(guestPlayer.id), sessions.getGuildId(guestPlayer.id), sessions.getGuildName(guestPlayer.id));

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

    if (sessions.getRoom(socket.id) || isMemberInAnyRoom(member.id)) {
      console.log(`[rankQueue:join] BLOCKED — already in room ${sessions.getRoom(socket.id) ?? '(다른 소켓)'}`);
      callback({ success: false, error: '이미 방에 참여 중입니다.' });
      return;
    }

    // 같은 사람의 join 이 겹치면 뒤엣것은 흘려보낸다. 앞선 요청이 큐에 넣거나
    // 매칭까지 끝내므로 사용자 입장에서는 성공으로 보여도 문제없다.
    if (joinInFlight.has(member.id)) {
      console.log(`[rankQueue:join] SKIP — 이미 처리 중인 join 이 있음 (${member.id.slice(0, 8)})`);
      callback({ success: true });
      return;
    }
    joinInFlight.add(member.id);
    try {
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

    // DB 를 다녀온 사이에 다른 경로로 방에 들어갔을 수 있다 — 큐에 넣기 직전에 다시 본다.
    if (sessions.getRoom(socket.id) || isMemberInAnyRoom(member.id)) {
      console.log('[rankQueue:join] BLOCKED — 대기 중 방에 입장함');
      callback({ success: false, error: '이미 방에 참여 중입니다.' });
      return;
    }

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
    } finally {
      joinInFlight.delete(member.id);
    }
  });

  socket.on('rank:queue:leave', () => {
    rankQueueStore.removeBySocket(socket.id);
    socket.emit('rank:queue:status', { inQueue: false, waitSeconds: 0 });
  });
}
