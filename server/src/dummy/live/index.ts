import { v4 as uuid } from 'uuid';
import type { DummyAiTier } from '@shared/dummy.js';
import { sessions } from '../../store/sessions.js';
import { roomStore } from '../../store/rooms.js';
import { rankQueueStore } from '../../store/rankQueue.js';
import { ensureRankStatsRow } from '../../db/rankStats.js';
import { isRankQueueAcceptingNewJoins } from '../../rank/kst.js';
import { handleLeaveRoom } from '../../socket/room.js';
import { makeDummySocket } from '../fakeSocket.js';
import { startDummyAgent } from '../agent.js';
import type { IO } from '../../socket/types.js';
import { ensureTitanMember } from './member.js';
import { hydrateLiveDummyRecords } from './records.js';
import { setLiveDummyMemberId, getLiveDummyMemberId } from './state.js';
import {
  isLiveDummyEnabled,
  isTitanLiveWindow,
  rejoinDelayMs,
  LIVE_DUMMY_NICKNAME,
  LIVE_DUMMY_SOCKET_ID,
} from './window.js';

let loopTimer: ReturnType<typeof setInterval> | null = null;
let ioRef: IO | null = null;
let joining = false;

export { isLiveDummyMemberId } from './state.js';
export function isLiveDummySocketId(socketId: string): boolean {
  return socketId === LIVE_DUMMY_SOCKET_ID;
}

function bindSession(memberId: string): string {
  const existing = sessions.getTokenByMemberId(memberId);
  const token = existing ?? uuid();
  sessions.linkToken(LIVE_DUMMY_SOCKET_ID, token);
  sessions.setNickname(LIVE_DUMMY_SOCKET_ID, LIVE_DUMMY_NICKNAME, true);
  sessions.setMemberInfo(token, memberId, null, [], null, null);
  return token;
}

async function sitInQueue(io: IO): Promise<void> {
  const memberId = getLiveDummyMemberId();
  if (!memberId || joining) return;
  if (!isTitanLiveWindow()) {
    rankQueueStore.removeByMemberId(memberId);
    return;
  }
  if (!isRankQueueAcceptingNewJoins()) return;
  if (roomStore.findByMemberId(memberId)) return;
  if (rankQueueStore.isPendingMatch(memberId)) return;
  if (rankQueueStore.has(memberId)) return;

  joining = true;
  try {
    bindSession(memberId);
    const row = await ensureRankStatsRow(memberId);
    if (!row.ok) {
      console.warn('[liveDummy] ensureRankStatsRow', row.error);
      return;
    }
    const entry = {
      socketId: LIVE_DUMMY_SOCKET_ID,
      memberId,
      nickname: LIVE_DUMMY_NICKNAME,
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
      console.log('[liveDummy] 큐 대기', LIVE_DUMMY_NICKNAME);
      return;
    }
    const { createRankMatchedRoom } = await import('../../socket/rankQueue.js');
    void createRankMatchedRoom(io, res.host, res.guest, row.seasonId).catch((err) => {
      console.warn('[liveDummy] createRankMatchedRoom', (err as Error).message);
    });
  } finally {
    joining = false;
  }
}

function afterLiveGameOver(io: IO): void {
  const delay = rejoinDelayMs();
  console.log(`[liveDummy] 판 끝 ${Math.round(delay / 1000)}초 뒤 재진입`);
  setTimeout(() => {
    handleLeaveRoom(io, makeDummySocket(LIVE_DUMMY_SOCKET_ID));
    void sitInQueue(io);
  }, delay);
}

export function maybeStartLiveDummyAgent(
  io: IO,
  roomId: string,
  dummyPlayerId: string,
  dummyMemberId: string,
  tier: DummyAiTier,
): void {
  void hydrateLiveDummyRecords(dummyPlayerId, dummyMemberId).finally(() => {
    startDummyAgent(io, roomId, dummyPlayerId, tier, {
      keepSession: true,
      onGameOver: () => afterLiveGameOver(io),
    });
  });
}

export async function startLiveDummy(io: IO): Promise<void> {
  if (!isLiveDummyEnabled()) return;
  ioRef = io;
  try {
    const memberId = await ensureTitanMember();
    setLiveDummyMemberId(memberId);
    bindSession(memberId);
    console.log(`[liveDummy] 회원 ${LIVE_DUMMY_NICKNAME} ${memberId.slice(0, 8)} 준비`);
  } catch (err) {
    console.warn('[liveDummy] 회원 준비 실패', (err as Error).message);
    return;
  }

  if (loopTimer) clearInterval(loopTimer);
  loopTimer = setInterval(() => {
    if (ioRef) void sitInQueue(ioRef);
  }, 5_000);
  void sitInQueue(io);
}
