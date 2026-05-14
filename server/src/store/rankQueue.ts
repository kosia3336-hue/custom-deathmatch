import { matchRp, type RankTier } from '@shared/types/rank.js';
import type { DisplayedTitle } from '@shared/types/room.js';

const COOLDOWN_MS = 60_000;

export interface RankQueueEntry {
  socketId: string;
  memberId: string;
  nickname: string;
  displayedTitle: DisplayedTitle | null;
  tier: RankTier;
  rp: number;
  placementDone: boolean;
  winStreak: number;
  lossStreak: number;
  joinedAt: number;
  seasonId: number;
  lastOpponentMemberId?: string;
  lastGameEndedAt?: number;
}

const byMemberId = new Map<string, RankQueueEntry>();
const socketToMemberId = new Map<string, string>();

/** 큐 밖일 때도 직전 상대 쿨다운 유지 */
const lastRankPair = new Map<string, { opponentMemberId: string; endedAt: number }>();

function cooldownOk(a: RankQueueEntry, b: RankQueueEntry, now: number): boolean {
  if (
    a.lastOpponentMemberId === b.memberId
    && a.lastGameEndedAt != null
    && now - a.lastGameEndedAt < COOLDOWN_MS
  ) {
    return false;
  }
  if (
    b.lastOpponentMemberId === a.memberId
    && b.lastGameEndedAt != null
    && now - b.lastGameEndedAt < COOLDOWN_MS
  ) {
    return false;
  }
  return true;
}

function pickOpponent(self: RankQueueEntry, now: number): RankQueueEntry | null {
  const all = [...byMemberId.values()].filter((e) => e.memberId !== self.memberId);
  const pool = all.filter((e) => cooldownOk(self, e, now));
  console.log(
    `[rankQueue] pickOpponent for ${self.nickname}(${self.memberId.slice(0, 8)}): candidates=${all.length}, after_cooldown=${pool.length}`,
    all.map((e) => {
      const cd = e.memberId === self.lastOpponentMemberId && self.lastGameEndedAt != null
        ? `cooldown ${Math.round((COOLDOWN_MS - (now - self.lastGameEndedAt!)) / 1000)}s left`
        : 'ok';
      return `${e.nickname}(${e.memberId.slice(0, 8)})[${cd}]`;
    }),
  );
  if (pool.length === 0) return null;

  const selfMrp = matchRp(self.tier, self.rp, self.placementDone);
  let best: RankQueueEntry | null = null;
  let bestDiff = Infinity;
  for (const c of pool) {
    const d = Math.abs(selfMrp - matchRp(c.tier, c.rp, c.placementDone));
    if (best === null || d < bestDiff || (d === bestDiff && c.joinedAt < best.joinedAt)) {
      best = c;
      bestDiff = d;
    }
  }
  return best;
}

function applyStoredCooldown(e: RankQueueEntry): RankQueueEntry {
  const prev = lastRankPair.get(e.memberId);
  if (!prev) return e;
  return {
    ...e,
    lastOpponentMemberId: prev.opponentMemberId,
    lastGameEndedAt: prev.endedAt,
  };
}

export function recordRankPairCooldown(aMemberId: string, bMemberId: string, endedAt: number): void {
  lastRankPair.set(aMemberId, { opponentMemberId: bMemberId, endedAt });
  lastRankPair.set(bMemberId, { opponentMemberId: aMemberId, endedAt });
}

export type RankEnqueueResult =
  | { matched: false }
  | { matched: true; host: RankQueueEntry; guest: RankQueueEntry };

export type RankMatchedPair = { host: RankQueueEntry; guest: RankQueueEntry };

export const rankQueueStore = {
  /** 큐 전체를 순회해 현재 매칭 가능한 페어를 모두 성사시킨다. 성사된 페어 목록을 반환. */
  attemptAllMatches(): RankMatchedPair[] {
    const now = Date.now();
    const matched: RankMatchedPair[] = [];
    const visited = new Set<string>();

    for (const entry of byMemberId.values()) {
      if (visited.has(entry.memberId)) continue;
      const opp = pickOpponent(entry, now);
      if (!opp) continue;

      visited.add(entry.memberId);
      visited.add(opp.memberId);

      byMemberId.delete(entry.memberId);
      byMemberId.delete(opp.memberId);
      socketToMemberId.delete(entry.socketId);
      socketToMemberId.delete(opp.socketId);

      const host = entry.joinedAt <= opp.joinedAt ? entry : opp;
      const guest = entry.joinedAt <= opp.joinedAt ? opp : entry;
      matched.push({ host, guest });
    }

    return matched;
  },

  enqueue(entry: RankQueueEntry): RankEnqueueResult {
    const hydrated = applyStoredCooldown(entry);

    const existing = byMemberId.get(hydrated.memberId);
    if (existing) socketToMemberId.delete(existing.socketId);

    byMemberId.set(hydrated.memberId, hydrated);
    socketToMemberId.set(hydrated.socketId, hydrated.memberId);

    console.log(`[rankQueue] enqueue: ${hydrated.nickname}(${hydrated.memberId.slice(0, 8)}) — queue size now ${byMemberId.size}`);

    const now = Date.now();
    const opp = pickOpponent(hydrated, now);
    if (!opp) return { matched: false };

    byMemberId.delete(hydrated.memberId);
    byMemberId.delete(opp.memberId);
    socketToMemberId.delete(hydrated.socketId);
    socketToMemberId.delete(opp.socketId);

    const host = hydrated.joinedAt <= opp.joinedAt ? hydrated : opp;
    const guest = hydrated.joinedAt <= opp.joinedAt ? opp : hydrated;

    return { matched: true, host, guest };
  },

  removeBySocket(socketId: string): void {
    const mid = socketToMemberId.get(socketId);
    if (!mid) return;
    socketToMemberId.delete(socketId);
    const cur = byMemberId.get(mid);
    if (cur?.socketId === socketId) byMemberId.delete(mid);
  },

  removeByMemberId(memberId: string): void {
    const cur = byMemberId.get(memberId);
    if (!cur) return;
    socketToMemberId.delete(cur.socketId);
    byMemberId.delete(memberId);
  },

  waitSeconds(memberId: string): number {
    const e = byMemberId.get(memberId);
    if (!e) return 0;
    return Math.max(0, Math.floor((Date.now() - e.joinedAt) / 1000));
  },
};
