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

/**
 * 매칭은 확정됐지만 아직 방이 만들어지지 않은 회원.
 *
 * 한 회원은 늘 {대기 없음 / 큐에 있음 / 매칭 확정 / 방에 있음} 중 하나여야 한다.
 * 그런데 매칭이 성사되면 큐에서는 바로 빠지는 반면 방은 비동기로 만들어지므로,
 * 그 사이에 이 회원은 어디에도 속하지 않는 상태가 된다. 하필 그때 같은 사람의
 * join 이 한 번 더 들어오면(버튼 연타, 재연결 재참가 등) 큐에 다시 들어가
 * 다른 상대와 또 매칭된다 — 랭크 방 두 개에 동시 배정.
 *
 * 그래서 '매칭 확정' 을 큐가 직접 들고 있는다. 검사·등록·매칭이 모두 이 모듈
 * 안의 동기 코드라, 중간에 다른 요청이 끼어들 수 없다(원자적).
 */
const pendingMatch = new Set<string>();

/** 매칭 확정 표시 — 방 생성이 끝나거나 실패하면 releaseMatch 로 푼다 */
function claim(a: RankQueueEntry, b: RankQueueEntry): void {
  pendingMatch.add(a.memberId);
  pendingMatch.add(b.memberId);
}

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

      claim(entry, opp);
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
    // 이미 매칭이 확정된 사람은 방이 만들어지는 중이다 — 큐에 다시 넣지 않는다.
    if (pendingMatch.has(entry.memberId)) return { matched: false };

    const hydrated = applyStoredCooldown(entry);

    const existing = byMemberId.get(hydrated.memberId);
    if (existing) socketToMemberId.delete(existing.socketId);

    byMemberId.set(hydrated.memberId, hydrated);
    socketToMemberId.set(hydrated.socketId, hydrated.memberId);

    console.log(`[rankQueue] enqueue: ${hydrated.nickname}(${hydrated.memberId.slice(0, 8)}) — queue size now ${byMemberId.size}`);

    const now = Date.now();
    const opp = pickOpponent(hydrated, now);
    if (!opp) return { matched: false };

    claim(hydrated, opp);
    byMemberId.delete(hydrated.memberId);
    byMemberId.delete(opp.memberId);
    socketToMemberId.delete(hydrated.socketId);
    socketToMemberId.delete(opp.socketId);

    const host = hydrated.joinedAt <= opp.joinedAt ? hydrated : opp;
    const guest = hydrated.joinedAt <= opp.joinedAt ? opp : hydrated;

    return { matched: true, host, guest };
  },

  /** 방 생성이 끝났거나(성공/실패) 취소됐을 때 '매칭 확정' 을 푼다 */
  releaseMatch(...memberIds: string[]): void {
    for (const id of memberIds) pendingMatch.delete(id);
  },

  /** 테스트용 — 매칭 확정 상태 확인 */
  isPendingMatch(memberId: string): boolean {
    return pendingMatch.has(memberId);
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
