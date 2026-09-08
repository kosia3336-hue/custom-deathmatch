import { v4 as uuid } from 'uuid';
import type { DummyAiTier } from '@shared/dummy.js';
import { liveDummyTierFor } from '@shared/dummy.js';
import { sessions } from '../../store/sessions.js';
import { roomStore } from '../../store/rooms.js';
import { rankQueueStore } from '../../store/rankQueue.js';
import { ensureRankStatsRow } from '../../db/rankStats.js';
import { isRankQueueAcceptingNewJoins } from '../../rank/kst.js';
import { handleLeaveRoom } from '../../socket/room.js';
import { makeDummySocket } from '../fakeSocket.js';
import { startDummyAgent } from '../agent.js';
import type { IO } from '../../socket/types.js';
import { ensureAllLiveDummyMembers } from './member.js';
import { hydrateLiveDummyRecords } from './records.js';
import {
  registerLiveDummy,
  getLiveDummyRuntime,
  getLiveDummyMemberIdBySocket,
} from './state.js';
import type { LiveDummyRuntime } from './roster.js';
import { LIVE_DUMMY_ROSTER, findRosterBySocketId, isLiveDummyWindowOpen } from './roster.js';
import { isLiveDummyEnabled, isLiveDummyRankEnabled, rejoinDelayMs } from './window.js';
import { liveDummyOnlineSignature } from './online.js';

export { isLiveDummyMemberId } from './state.js';

const joining = new Set<string>();
let loopTimer: ReturnType<typeof setInterval> | null = null;
let ioRef: IO | null = null;
let lastOnlineSig = '';

async function broadcastDummyPresence(io: IO): Promise<void> {
  const sig = liveDummyOnlineSignature();
  if (sig === lastOnlineSig) return;
  lastOnlineSig = sig;
  const { broadcastOnlineUsers } = await import('../../socket/lobby.js');
  broadcastOnlineUsers(io);
}

export function isLiveDummySocketId(socketId: string): boolean {
  return !!findRosterBySocketId(socketId) || socketId.startsWith('live-dummy:');
}

function bindSession(dummy: LiveDummyRuntime, memberId: string): string {
  const existing = sessions.getTokenByMemberId(memberId);
  const token = existing ?? uuid();
  sessions.linkToken(dummy.socketId, token);
  sessions.setNickname(dummy.socketId, dummy.nickname, true);
  sessions.setMemberInfo(token, memberId, null, [], null, null);
  return token;
}

async function sitInQueue(io: IO, dummy: LiveDummyRuntime, memberId: string): Promise<void> {
  if (joining.has(dummy.key)) return;
  if (!isLiveDummyRankEnabled()) {
    rankQueueStore.removeByMemberId(memberId);
    await broadcastDummyPresence(io);
    return;
  }
  if (!isLiveDummyWindowOpen(dummy.window)) {
    rankQueueStore.removeByMemberId(memberId);
    await broadcastDummyPresence(io);
    return;
  }
  if (!isRankQueueAcceptingNewJoins()) return;
  if (roomStore.findByMemberId(memberId)) return;
  if (rankQueueStore.isPendingMatch(memberId)) return;
  if (rankQueueStore.has(memberId)) return;

  joining.add(dummy.key);
  try {
    bindSession(dummy, memberId);
    const row = await ensureRankStatsRow(memberId);
    if (!row.ok) {
      console.warn('[liveDummy] ensureRankStatsRow', dummy.nickname, row.error);
      return;
    }
    const entry = {
      socketId: dummy.socketId,
      memberId,
      nickname: dummy.nickname,
      displayedTitle: null,
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
      const { startRetryTimer } = await import('../../socket/rankQueue.js');
      startRetryTimer(io);
      console.log('[liveDummy] 큐 대기', dummy.nickname);
      await broadcastDummyPresence(io);
      return;
    }
    const { createRankMatchedRoom } = await import('../../socket/rankQueue.js');
    void createRankMatchedRoom(io, res.host, res.guest, row.seasonId).catch((err) => {
      console.warn('[liveDummy] createRankMatchedRoom', dummy.nickname, (err as Error).message);
    });
  } finally {
    joining.delete(dummy.key);
  }
}

function afterLiveGameOver(io: IO, dummy: LiveDummyRuntime, memberId: string): void {
  const delay = rejoinDelayMs();
  console.log(`[liveDummy] ${dummy.nickname} 판 끝 ${Math.round(delay / 1000)}초 뒤 재진입`);
  setTimeout(() => {
    handleLeaveRoom(io, makeDummySocket(dummy.socketId));
    void sitInQueue(io, dummy, memberId);
  }, delay);
}

export function maybeStartLiveDummyAgent(
  io: IO,
  roomId: string,
  dummyPlayerId: string,
  dummyMemberId: string,
  tier: DummyAiTier,
): void {
  const dummy = getLiveDummyRuntime(dummyMemberId);
  const nickname = dummy?.nickname ?? '';
  void hydrateLiveDummyRecords(dummyPlayerId, dummyMemberId).finally(() => {
    startDummyAgent(io, roomId, dummyPlayerId, dummy?.defaultTier ?? tier, {
      keepSession: true,
      tierForGame: (gameId) => liveDummyTierFor(nickname, gameId),
      onGameOver: dummy
        ? () => afterLiveGameOver(io, dummy, dummyMemberId)
        : undefined,
    });
  });
}

export async function startLiveDummy(io: IO): Promise<void> {
  if (!isLiveDummyEnabled()) return;
  ioRef = io;
  try {
    const ready = await ensureAllLiveDummyMembers();
    for (const { dummy, memberId } of ready) {
      registerLiveDummy(memberId, dummy);
      bindSession(dummy, memberId);
      console.log(`[liveDummy] 회원 ${dummy.nickname} ${memberId.slice(0, 8)} 준비`);
    }
  } catch (err) {
    console.warn('[liveDummy] 회원 준비 실패', (err as Error).message);
    return;
  }

  if (loopTimer) clearInterval(loopTimer);
  loopTimer = setInterval(() => {
    if (!ioRef) return;
    for (const dummy of LIVE_DUMMY_ROSTER) {
      const memberId = getLiveDummyMemberIdBySocket(dummy.socketId);
      if (memberId) void sitInQueue(ioRef, dummy, memberId);
    }
    void broadcastDummyPresence(ioRef);
  }, 5_000);

  for (const dummy of LIVE_DUMMY_ROSTER) {
    const memberId = getLiveDummyMemberIdBySocket(dummy.socketId);
    if (memberId) void sitInQueue(io, dummy, memberId);
  }
  await broadcastDummyPresence(io);
}
