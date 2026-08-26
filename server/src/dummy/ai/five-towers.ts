import type { DummyAiTier } from '@shared/dummy.js';
import type {
  FTAction,
  FTActionLogEntry,
  FTInfoResult,
  FTItem,
  FTMilestoneEntry,
  FTPhase,
  FTSecretLog,
  FTStackCount,
  FTTower,
  FTTowerPublicInfo,
  FTUnresolvedSecret,
} from '@shared/types/five-towers.js';
import {
  FT_HALF_MILESTONE,
  FT_MAX_SCORE,
  FT_MAX_STACK,
  FT_TOWERS,
  FT_TOWER_MAX_HEIGHT,
} from '@shared/types/five-towers.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-011 · multi · 전적 집계 322판.
 * COM InternalState.height 를 읽지 않는다. 마일스톤 밴드 + 공개 스택 샘플.
 */

/** 기보 공개 쌓기 칸 수 (1:37.2 2:22.6 3:40.2) */
const STACK_W = [0, 372, 226, 402] as const;

export interface FiveTowersDummyView {
  gameOver: boolean;
  phase: FTPhase;
  turn: number;
  currentPlayerId: string;
  myId: string;
  oppId: string;
  myScore: number;
  oppScore: number;
  myStacked: Record<FTTower, number>;
  itemUsed: boolean;
  myItemUsedKind: FTItem | null;
  towers: Record<FTTower, FTTowerPublicInfo>;
  myInfoResults: FTInfoResult[];
  mySecretLog: FTSecretLog[];
  unresolvedSecrets: FTUnresolvedSecret[];
  actionLog: FTActionLogEntry[];
  milestoneLog: FTMilestoneEntry[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type Heights = Record<FTTower, number>;

type Cand = { action: FTAction; key: string };

function tierKnobs(tier: DummyAiTier): { uniformMix: number; softmaxTemp: number } {
  if (tier === '하') return { uniformMix: 0.38, softmaxTemp: 0.06 };
  if (tier === '중') return { uniformMix: 0.08, softmaxTemp: 0.016 };
  return { uniformMix: 0.03, softmaxTemp: 0.01 };
}

function emptyHeights(): Heights {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

export function heightBand(
  pub: FTTowerPublicInfo,
  myStacked: number,
): { lo: number; hi: number } {
  if (pub.completed) return { lo: FT_TOWER_MAX_HEIGHT, hi: FT_TOWER_MAX_HEIGHT };
  const lo0 = pub.milestonesReached.half ? FT_HALF_MILESTONE : 0;
  const hi0 = pub.milestonesReached.half ? FT_TOWER_MAX_HEIGHT - 1 : FT_HALF_MILESTONE - 1;
  const lo = Math.max(lo0, myStacked, pub.minKnownHeight);
  const hi = Math.max(lo, hi0);
  return { lo, hi };
}

/** 상대 공개 스택이 없고 시크릿도 이 탑이 아니면 높이 = 내 기여. */
export function inferredBand(view: FiveTowersDummyView, tower: FTTower): { lo: number; hi: number } {
  const pub = view.towers[tower]!;
  const mine = view.myStacked[tower] ?? 0;
  const base = heightBand(pub, mine);
  if (pub.completed) return base;
  const nOpp = oppStackTurns(view, tower).length;
  const secret = oppSecretPending(view);
  const secretCould = secret === 'preHalf' ? !pub.milestonesReached.half : secret === 'half' ? pub.milestonesReached.half : false;
  if (nOpp === 0 && !secretCould) {
    const v = Math.min(base.hi, Math.max(base.lo, mine));
    return { lo: v, hi: v };
  }
  const lo = Math.max(base.lo, mine);
  const hi = Math.min(base.hi, mine + 3 * nOpp + (secretCould ? 3 : 0));
  return { lo, hi: Math.max(lo, hi) };
}

/** 하한 ≥ 8 이면 3칸으로 무조건 완성. */
export function sureCompleteTowers(view: FiveTowersDummyView): FTTower[] {
  return FT_TOWERS.filter((t) => {
    const pub = view.towers[t];
    if (!pub || pub.completed) return false;
    return inferredBand(view, t).lo >= FT_TOWER_MAX_HEIGHT - FT_MAX_STACK;
  });
}

/** 높이가 확정이면, 이 칸 수는 상대에게 남은 1~2를 남긴다. */
export function isKnownGift(view: FiveTowersDummyView, tower: FTTower, count: FTStackCount): boolean {
  const pub = view.towers[tower];
  if (!pub || pub.completed) return true;
  const { lo, hi } = inferredBand(view, tower);
  if (lo !== hi) return false;
  const left = FT_TOWER_MAX_HEIGHT - Math.min(FT_TOWER_MAX_HEIGHT, lo + count);
  return left === 1 || left === 2;
}

function sampleStackCount(): FTStackCount {
  const r = Math.random() * 1000;
  if (r < STACK_W[1]) return 1;
  if (r < STACK_W[1] + STACK_W[2]) return 2;
  return 3;
}

function oppStackTurns(view: FiveTowersDummyView, tower: FTTower): number[] {
  const turns: number[] = [];
  for (const e of view.actionLog) {
    if (e.actorId !== view.oppId) continue;
    if (e.kind !== 'stack-public') continue;
    if (e.tower !== tower) continue;
    turns.push(e.turn);
  }
  return turns;
}

function myStackAfter(view: FiveTowersDummyView, tower: FTTower, afterTurn: number): number {
  let n = 0;
  for (const e of view.actionLog) {
    if (e.actorId !== view.myId) continue;
    if (e.tower !== tower) continue;
    if (e.turn <= afterTurn) continue;
    if (e.kind === 'stack-public' || e.kind === 'secret-hidden' || e.kind === 'secret-revealed') {
      n += e.count ?? 0;
    }
  }
  return n;
}

function oppSecretPending(view: FiveTowersDummyView): 'preHalf' | 'half' | null {
  const hidden = view.actionLog.some(
    (e) => e.actorId === view.oppId && e.kind === 'secret-hidden',
  );
  const revealed = view.actionLog.some(
    (e) => e.actorId === view.oppId && e.kind === 'secret-revealed',
  );
  if (!hidden || revealed) return null;
  const unresolved = view.unresolvedSecrets.some((u) => u.actorId === view.oppId);
  return unresolved ? 'preHalf' : 'half';
}

function lastOppTower(view: FiveTowersDummyView): FTTower | null {
  for (let i = view.actionLog.length - 1; i >= 0; i--) {
    const e = view.actionLog[i]!;
    if (e.actorId !== view.oppId) continue;
    if ((e.kind === 'stack-public' || e.kind === 'secret-revealed') && e.tower) return e.tower;
  }
  return null;
}

function incomplete(view: FiveTowersDummyView): FTTower[] {
  return FT_TOWERS.filter((t) => !view.towers[t]!.completed);
}

function applyCap(h: number, count: number): { h: number; scored: boolean } {
  const room = FT_TOWER_MAX_HEIGHT - h;
  const actual = Math.min(count, Math.max(0, room));
  const next = h + actual;
  return { h: next, scored: h < FT_TOWER_MAX_HEIGHT && next >= FT_TOWER_MAX_HEIGHT };
}

function copyH(h: Heights): Heights {
  return { A: h.A, B: h.B, C: h.C, D: h.D, E: h.E };
}

/**
 * 공개 밴드를 지키는 높이 세계 하나.
 * 상대 공개 스택은 기보 1/2/3, 제로는 후반 6~10칸 탑에 한 장 0.
 */
export function sampleHeights(view: FiveTowersDummyView, uniformMix: number): Heights | null {
  for (let attempt = 0; attempt < 24; attempt++) {
    const h = emptyHeights();
    const secretKind = oppSecretPending(view);
    const secretAmt: FTStackCount = sampleStackCount();
    const secretPool = incomplete(view).filter((t) => {
      const half = view.towers[t]!.milestonesReached.half;
      if (secretKind === 'preHalf') return !half;
      if (secretKind === 'half') return half;
      return false;
    });
    const secretT =
      secretKind && secretPool.length > 0
        ? secretPool[Math.floor(Math.random() * secretPool.length)]!
        : null;

    let zeroT: FTTower | null = null;
    if (Math.random() < 0.55 && view.turn >= 12) {
      const bait = incomplete(view).filter((t) => {
        const b = heightBand(view.towers[t]!, view.myStacked[t] ?? 0);
        return b.lo >= FT_HALF_MILESTONE && b.hi <= 7;
      });
      if (bait.length > 0) zeroT = bait[Math.floor(Math.random() * bait.length)]!;
    }

    let ok = true;
    for (const t of FT_TOWERS) {
      const pub = view.towers[t]!;
      const band = heightBand(pub, view.myStacked[t] ?? 0);
      if (pub.completed) {
        h[t] = FT_TOWER_MAX_HEIGHT;
        continue;
      }
      const turns = oppStackTurns(view, t);
      let oppSum = 0;
      for (let i = 0; i < turns.length; i++) {
        if (zeroT === t && i === turns.length - 1) continue;
        oppSum += uniformMix > Math.random() ? (1 + Math.floor(Math.random() * 3)) : sampleStackCount();
      }
      let v = (view.myStacked[t] ?? 0) + oppSum;
      if (secretT === t) v += secretAmt;
      if (v < band.lo || v > band.hi) {
        if (uniformMix > 0.2) {
          v = band.lo + Math.floor(Math.random() * (band.hi - band.lo + 1));
        } else {
          ok = false;
          break;
        }
      }
      h[t] = v;
    }
    if (!ok) continue;

    for (const info of view.myInfoResults) {
      const [a, b] = info.targets;
      const da = myStackAfter(view, a, info.turn) + oppStackTurns(view, a).filter((tn) => tn > info.turn).length;
      const db = myStackAfter(view, b, info.turn) + oppStackTurns(view, b).filter((tn) => tn > info.turn).length;
      // 상대 이후 스택은 1~3이라 합 제약이 느슨. 하한만: 현재 - 최대증가 ≤ 당시합 ≤ 현재.
      const maxDelta = da * 3 + db * 3;
      const sumNow = h[a]! + h[b]!;
      if (sumNow < info.sumAtTime || sumNow - maxDelta > info.sumAtTime + 3) {
        ok = false;
        break;
      }
    }
    if (ok) return h;
  }

  const fallback = emptyHeights();
  for (const t of FT_TOWERS) {
    const band = heightBand(view.towers[t]!, view.myStacked[t] ?? 0);
    fallback[t] = band.lo + Math.floor(Math.random() * (band.hi - band.lo + 1));
  }
  return fallback;
}

function oppReply(
  h: Heights,
  myScore: number,
  oppScore: number,
  lastTower: FTTower | null,
  baitTower: FTTower | null,
): { h: Heights; myScore: number; oppScore: number } {
  const next = copyH(h);
  let os = oppScore;
  const live = FT_TOWERS.filter((t) => next[t]! < FT_TOWER_MAX_HEIGHT);

  const take = live
    .map((t) => ({ t, rem: FT_TOWER_MAX_HEIGHT - next[t]! }))
    .filter((x) => x.rem >= 1 && x.rem <= 3)
    .sort((a, b) => a.rem - b.rem);
  if (take.length > 0 && baitTower == null) {
    const pick = take[0]!;
    const r = applyCap(next[pick.t]!, pick.rem);
    next[pick.t] = r.h;
    if (r.scored) os += 1;
    return { h: next, myScore, oppScore: os };
  }

  let target: FTTower | null = baitTower && next[baitTower]! < FT_TOWER_MAX_HEIGHT ? baitTower : lastTower;
  if (!target || next[target]! >= FT_TOWER_MAX_HEIGHT) {
    const ranked = live
      .map((t) => ({ t, rem: FT_TOWER_MAX_HEIGHT - next[t]! }))
      .sort((a, b) => a.rem - b.rem);
    target = ranked[0]?.t ?? null;
  }
  if (!target) return { h: next, myScore, oppScore: os };

  const rem = FT_TOWER_MAX_HEIGHT - next[target]!;
  let count: FTStackCount = 3;
  if (rem >= 4 && rem <= 5) count = 1;
  else if (rem <= 3) count = Math.max(1, rem) as FTStackCount;
  const r = applyCap(next[target], count);
  next[target] = r.h;
  if (r.scored) os += 1;
  return { h: next, myScore, oppScore: os };
}

function pWinFrom(myScore: number, oppScore: number, h: Heights, myStacked: Record<FTTower, number>): number {
  if (myScore >= FT_MAX_SCORE) return 1;
  if (oppScore >= FT_MAX_SCORE) return 0;
  let close = 0;
  let myLead = 0;
  for (const t of FT_TOWERS) {
    if (h[t]! >= FT_TOWER_MAX_HEIGHT) continue;
    const rem = FT_TOWER_MAX_HEIGHT - h[t]!;
    if (rem <= 3) close += 1;
    const mine = myStacked[t] ?? 0;
    if (mine > h[t]! - mine) myLead += 1;
  }
  const x = 1.15 * (myScore - oppScore) + 0.28 * close + 0.06 * myLead;
  return 1 / (1 + Math.exp(-x));
}

function evalStack(
  view: FiveTowersDummyView,
  h0: Heights,
  tower: FTTower,
  count: FTStackCount,
  lastTower: FTTower | null,
): number {
  const h = copyH(h0);
  const before = h[tower]!;
  const r = applyCap(before, count);
  h[tower] = r.h;
  let my = view.myScore + (r.scored ? 1 : 0);
  let opp = view.oppScore;
  if (my >= FT_MAX_SCORE) return 1;

  const left = FT_TOWER_MAX_HEIGHT - h[tower]!;
  // 기보: 남은 1 방치 → 상대 94%, 남은 2 → 82%
  if (left === 1) return 0.04;
  if (left === 2) return 0.12;

  const after = oppReply(h, my, opp, tower, null);
  if (after.oppScore >= FT_MAX_SCORE) return 0;
  const stacked = { ...view.myStacked, [tower]: (view.myStacked[tower] ?? 0) + (r.h - before) };
  return pWinFrom(after.myScore, after.oppScore, after.h, stacked);
}

function evalZero(view: FiveTowersDummyView, h0: Heights, tower: FTTower): number {
  const after = oppReply(copyH(h0), view.myScore, view.oppScore, lastOppTower(view), tower);
  if (after.oppScore >= FT_MAX_SCORE) return 0;
  return pWinFrom(after.myScore, after.oppScore, after.h, view.myStacked) + 0.03;
}

function evalSecret(
  view: FiveTowersDummyView,
  h0: Heights,
  tower: FTTower,
  count: FTStackCount,
): number {
  const h = copyH(h0);
  const r = applyCap(h[tower]!, count);
  h[tower] = r.h;
  const my = view.myScore + (r.scored ? 1 : 0);
  if (my >= FT_MAX_SCORE) return 0.97;
  const left = FT_TOWER_MAX_HEIGHT - h[tower]!;
  if (left === 1 || left === 2) return 0.08;
  const after = oppReply(h, my, view.oppScore, lastOppTower(view), null);
  if (after.oppScore >= FT_MAX_SCORE) return 0;
  const stacked = { ...view.myStacked, [tower]: (view.myStacked[tower] ?? 0) + count };
  return pWinFrom(after.myScore, after.oppScore, after.h, stacked) + 0.02;
}

function openingBias(view: FiveTowersDummyView, tower: FTTower): number {
  if (view.turn > 4) return 0;
  const table: Record<FTTower, number> = { A: 0.035, B: 0.02, C: 0.01, D: 0.004, E: 0 };
  return table[tower];
}

function candidates(view: FiveTowersDummyView): Cand[] {
  const live = incomplete(view);
  const sure = sureCompleteTowers(view);
  const out: Cand[] = [];

  if (sure.length > 0) {
    for (const t of sure) {
      out.push({ action: { type: 'stack', tower: t, count: 3 }, key: `stack:${t}:3` });
    }
    return out;
  }

  for (const t of live) {
    for (const c of [1, 2, 3] as FTStackCount[]) {
      if (isKnownGift(view, t, c)) continue;
      out.push({ action: { type: 'stack', tower: t, count: c }, key: `stack:${t}:${c}` });
    }
  }

  if (!view.itemUsed && live.length >= 2) {
    const uncertain = live.filter((t) => {
      const b = inferredBand(view, t);
      return b.hi - b.lo >= 2;
    });
    if (uncertain.length >= 2 && view.turn >= 6) {
      const hot = [...uncertain].sort((a, b) => {
        const ha = inferredBand(view, a);
        const hb = inferredBand(view, b);
        return hb.hi - ha.hi;
      });
      out.push({
        action: { type: 'item', item: 'info', targets: [hot[0]!, hot[1]!] },
        key: `info:${hot[0]},${hot[1]}`,
      });
    }

    for (const t of live) {
      const b = inferredBand(view, t);
      if (b.lo >= FT_HALF_MILESTONE && b.hi <= 7 && view.turn >= 10) {
        out.push({ action: { type: 'item', item: 'zero', target: t }, key: `zero:${t}` });
      }
    }

    if (view.turn >= 10) {
      for (const t of live) {
        const b = inferredBand(view, t);
        if (b.lo >= FT_HALF_MILESTONE && b.hi >= 7) {
          out.push({ action: { type: 'item', item: 'secret', target: t, count: 3 }, key: `secret:${t}:3` });
        }
      }
    }
  }

  if (out.length === 0 && live[0]) {
    out.push({ action: { type: 'stack', tower: live[0], count: 1 }, key: `stack:${live[0]}:1` });
  }
  return out;
}

function pickSoftmax(scored: Array<{ cand: Cand; score: number }>, tier: DummyAiTier, temp: number): Cand {
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return { action: { type: 'stack', tower: 'A', count: 1 }, key: 'stack:A:1' };
  }
  if (tier === '상') {
    if (scored.length > 1 && Math.random() < 0.05 && scored[0]!.score - scored[1]!.score < 0.025) {
      return scored[1]!.cand;
    }
    return scored[0]!.cand;
  }
  const t = Math.max(0.006, temp);
  const maxS = scored[0]!.score;
  const weights = scored.map((x) => Math.exp((x.score - maxS) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return scored[i]!.cand;
  }
  return scored[scored.length - 1]!.cand;
}

function scoreAction(view: FiveTowersDummyView, h: Heights, action: FTAction, last: FTTower | null): number {
  if (action.type === 'stack') {
    return evalStack(view, h, action.tower, action.count, last) + openingBias(view, action.tower);
  }
  if (action.item === 'zero') return evalZero(view, h, action.target);
  if (action.item === 'secret') return evalSecret(view, h, action.target, action.count);
  // info: 불확실 해소 보너스. 합을 샘플 세계에서 본 뒤 그 두 탑 중 가까운 쪽에 쌓는 근사.
  const [a, b] = action.targets;
  const remA = FT_TOWER_MAX_HEIGHT - h[a]!;
  const remB = FT_TOWER_MAX_HEIGHT - h[b]!;
  const closer = remA <= remB ? a : b;
  const count: FTStackCount = Math.max(1, Math.min(3, FT_TOWER_MAX_HEIGHT - h[closer]!)) as FTStackCount;
  return evalStack(view, h, closer, count, last) + 0.015;
}

/**
 * 공개 뷰만. 확정 완성·확정 선물 금지는 상중하 공통.
 */
export async function pickFiveTowersActionAsync(
  view: FiveTowersDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<FTAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  if (view.phase !== 'turn') return null;
  if (view.currentPlayerId !== dummyId) return null;

  const live = incomplete(view);
  if (live.length === 0) return null;

  const cands = candidates(view);
  const knobs = tierKnobs(tier);
  const last = lastOppTower(view);
  const acc = new Map<string, { cand: Cand; sum: number; n: number }>();
  for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });

  const oppMatch = view.oppScore === FT_MAX_SCORE - 1;

  await runPsychologySearch(budgetMs, () => {
    const h = sampleHeights(view, knobs.uniformMix);
    if (!h) return;
    for (const c of cands) {
      if (oppMatch && c.action.type === 'stack') {
        const b = inferredBand(view, c.action.tower);
        const hasClose = live.some((t) => inferredBand(view, t).hi >= 8);
        if (hasClose && b.hi <= 5) continue;
      }
      const sc = scoreAction(view, h, c.action, last);
      const a = acc.get(c.key)!;
      a.sum += sc;
      a.n += 1;
    }
  }, { batchSize: 8 });

  const scored = [...acc.values()]
    .filter((a) => a.n > 0)
    .map((a) => ({ cand: a.cand, score: a.sum / a.n }));
  if (scored.length === 0) {
    const t = live[0]!;
    return { type: 'stack', tower: t, count: 1 };
  }

  const picked = pickSoftmax(scored, tier, knobs.softmaxTemp).action;
  if (picked.type === 'stack' && isKnownGift(view, picked.tower, picked.count) && sureCompleteTowers(view).length === 0) {
    const t = live[0]!;
    return { type: 'stack', tower: t, count: 1 };
  }
  return picked;
}

export function justUsedInfoThisTurn(view: FiveTowersDummyView): boolean {
  return view.myInfoResults.some((r) => r.turn === view.turn);
}
