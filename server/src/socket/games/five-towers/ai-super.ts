/* 5개의 탑 슈퍼 자문: 진짜 높이 금지. 3점 레이스. COM ai.ts 안 씀. */
import type {
  FTAction,
  FTStackCount,
  FTTower,
  FtAdvisorPly,
  FtAdvisorSnapshot,
} from '@shared/types/five-towers.js';
import {
  FT_HALF_MILESTONE,
  FT_MAX_SCORE,
  FT_TOWERS,
  FT_TOWER_MAX_HEIGHT,
  ftAdvisorSnapshot,
  ftHeightBand,
  ftInferredBand,
  ftIsKnownGift,
  ftOppSecretPendingKind,
  ftOppStackTurns,
  ftSureCompleteTowers,
} from '@shared/types/five-towers.js';

export const FT_SUPER_THINK_MS = 90_000;
const MIX = 0.5;
const CLOCK_MASK = 255;

export type FtAdvisorPick = { action: FTAction; winRate: number };

type Heights = Record<FTTower, number>;

let _deadline = 0;
let _timedOut = false;
let _allowTimeout = true;
let _nodes = 0;

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function emptyH(): Heights {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

function copyH(h: Heights): Heights {
  return { A: h.A, B: h.B, C: h.C, D: h.D, E: h.E };
}

function applyCap(h: number, count: number): { h: number; scored: boolean } {
  const room = FT_TOWER_MAX_HEIGHT - h;
  const actual = Math.min(count, Math.max(0, room));
  const next = h + actual;
  return { h: next, scored: h < FT_TOWER_MAX_HEIGHT && next >= FT_TOWER_MAX_HEIGHT };
}

function incomplete(snap: FtAdvisorSnapshot): FTTower[] {
  return FT_TOWERS.filter((t) => !snap.towers[t]!.completed);
}

function sampleCount(): FTStackCount {
  const r = Math.random();
  if (r < 0.372) return 1;
  if (r < 0.598) return 2;
  return 3;
}

function sampleHeights(snap: FtAdvisorSnapshot): Heights | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    tick();
    const h = emptyH();
    const secretKind = ftOppSecretPendingKind(snap);
    const secretAmt: FTStackCount = sampleCount();
    const secretPool = incomplete(snap).filter((t) => {
      const half = snap.towers[t]!.milestonesReached.half;
      if (secretKind === 'preHalf') return !half;
      return false;
    });
    const secretT =
      secretKind && secretPool.length > 0
        ? secretPool[Math.floor(Math.random() * secretPool.length)]!
        : null;

    let ok = true;
    for (const t of FT_TOWERS) {
      const pub = snap.towers[t]!;
      const band = ftHeightBand(pub, snap.myStacked[t] ?? 0);
      if (pub.completed) {
        h[t] = FT_TOWER_MAX_HEIGHT;
        continue;
      }
      const turns = ftOppStackTurns(snap, t);
      let oppSum = 0;
      for (let i = 0; i < turns.length; i++) oppSum += sampleCount();
      let v = (snap.myStacked[t] ?? 0) + oppSum;
      if (secretT === t) v += secretAmt;
      if (v < band.lo || v > band.hi) {
        v = band.lo + Math.floor(Math.random() * (band.hi - band.lo + 1));
      }
      h[t] = v;
    }
    if (!ok) continue;

    for (const info of snap.myInfoResults) {
      const [a, b] = info.targets;
      const sumNow = h[a]! + h[b]!;
      if (sumNow < info.sumAtTime) {
        ok = false;
        break;
      }
    }
    if (ok) return h;
  }

  const fallback = emptyH();
  for (const t of FT_TOWERS) {
    const band = ftInferredBand(snap, t);
    fallback[t] = band.lo + Math.floor(Math.random() * (band.hi - band.lo + 1));
  }
  return fallback;
}

function oppReply(h: Heights, myScore: number, oppScore: number, lastTower: FTTower | null): {
  h: Heights;
  myScore: number;
  oppScore: number;
} {
  const next = copyH(h);
  let os = oppScore;
  const live = FT_TOWERS.filter((t) => next[t]! < FT_TOWER_MAX_HEIGHT);
  const take = live
    .map((t) => ({ t, rem: FT_TOWER_MAX_HEIGHT - next[t]! }))
    .filter((x) => x.rem >= 1 && x.rem <= 3)
    .sort((a, b) => a.rem - b.rem);
  if (take.length > 0) {
    const pick = take[0]!;
    const r = applyCap(next[pick.t]!, pick.rem);
    next[pick.t] = r.h;
    if (r.scored) os += 1;
    return { h: next, myScore, oppScore: os };
  }
  let target = lastTower && next[lastTower]! < FT_TOWER_MAX_HEIGHT ? lastTower : null;
  if (!target) {
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

function lastOppTower(snap: FtAdvisorSnapshot): FTTower | null {
  for (let i = snap.actionLog.length - 1; i >= 0; i--) {
    const e = snap.actionLog[i]!;
    if (e.actorId !== 'opp') continue;
    if ((e.kind === 'stack-public' || e.kind === 'secret-revealed') && e.tower) return e.tower;
  }
  return null;
}

function evalStack(
  snap: FtAdvisorSnapshot,
  h0: Heights,
  tower: FTTower,
  count: FTStackCount,
): number {
  const h = copyH(h0);
  const before = h[tower]!;
  const r = applyCap(before, count);
  h[tower] = r.h;
  let my = snap.myScore + (r.scored ? 1 : 0);
  if (my >= FT_MAX_SCORE) return 1;
  const left = FT_TOWER_MAX_HEIGHT - h[tower]!;
  if (left === 1) return 0.04;
  if (left === 2) return 0.12;
  const after = oppReply(h, my, snap.oppScore, tower);
  if (after.oppScore >= FT_MAX_SCORE) return 0;
  const stacked = { ...snap.myStacked, [tower]: (snap.myStacked[tower] ?? 0) + (r.h - before) };
  return pWinFrom(after.myScore, after.oppScore, after.h, stacked);
}

function evalZero(snap: FtAdvisorSnapshot, h0: Heights, tower: FTTower): number {
  const after = oppReply(copyH(h0), snap.myScore, snap.oppScore, lastOppTower(snap));
  if (after.oppScore >= FT_MAX_SCORE) return 0;
  let p = pWinFrom(after.myScore, after.oppScore, after.h, snap.myStacked) + 0.02;
  const rem = FT_TOWER_MAX_HEIGHT - h0[tower]!;
  if (rem >= 4 && rem <= 5) p += 0.04;
  return p;
}

function evalSecret(snap: FtAdvisorSnapshot, h0: Heights, tower: FTTower, count: FTStackCount): number {
  const h = copyH(h0);
  const r = applyCap(h[tower]!, count);
  h[tower] = r.h;
  const my = snap.myScore + (r.scored ? 1 : 0);
  if (my >= FT_MAX_SCORE) return 0.98;
  const left = FT_TOWER_MAX_HEIGHT - h[tower]!;
  if (left === 1 || left === 2) return 0.08;
  const after = oppReply(h, my, snap.oppScore, lastOppTower(snap));
  if (after.oppScore >= FT_MAX_SCORE) return 0;
  const stacked = { ...snap.myStacked, [tower]: (snap.myStacked[tower] ?? 0) + count };
  return pWinFrom(after.myScore, after.oppScore, after.h, stacked) + 0.02;
}

function evalInfo(snap: FtAdvisorSnapshot, h0: Heights, a: FTTower, b: FTTower): number {
  const remA = FT_TOWER_MAX_HEIGHT - h0[a]!;
  const remB = FT_TOWER_MAX_HEIGHT - h0[b]!;
  const closer = remA <= remB ? a : b;
  const count = Math.max(1, Math.min(3, FT_TOWER_MAX_HEIGHT - h0[closer]!)) as FTStackCount;
  return evalStack(snap, h0, closer, count) + 0.02;
}

function actionKey(action: FTAction): string {
  if (action.type === 'stack') return `stack:${action.tower}:${action.count}`;
  if (action.item === 'info') return `info:${action.targets[0]},${action.targets[1]}`;
  if (action.item === 'zero') return `zero:${action.target}`;
  return `secret:${action.target}:${action.count}`;
}

function candidates(snap: FtAdvisorSnapshot): FTAction[] {
  const live = incomplete(snap);
  const sure = ftSureCompleteTowers(snap);
  const out: FTAction[] = [];
  if (sure.length > 0) {
    for (const t of sure) out.push({ type: 'stack', tower: t, count: 3 });
    return out;
  }
  for (const t of live) {
    for (const c of [1, 2, 3] as FTStackCount[]) {
      if (ftIsKnownGift(snap, t, c)) continue;
      out.push({ type: 'stack', tower: t, count: c });
    }
  }
  if (!snap.itemUsed && live.length >= 2 && snap.turn >= 6) {
    const uncertain = live.filter((t) => {
      const b = ftInferredBand(snap, t);
      return b.hi - b.lo >= 2;
    });
    if (uncertain.length >= 2) {
      const hot = [...uncertain].sort((a, b) => {
        const ha = ftInferredBand(snap, a);
        const hb = ftInferredBand(snap, b);
        return hb.hi - ha.hi;
      });
      out.push({ type: 'item', item: 'info', targets: [hot[0]!, hot[1]!] });
    }
    if (snap.turn >= 10) {
      for (const t of live) {
        const b = ftInferredBand(snap, t);
        if (b.lo >= FT_HALF_MILESTONE && b.hi <= 7) {
          out.push({ type: 'item', item: 'zero', target: t });
        }
        if (b.lo >= FT_HALF_MILESTONE && b.hi >= 8) {
          out.push({ type: 'item', item: 'secret', target: t, count: 3 });
        }
      }
    }
  }
  if (out.length === 0 && live[0]) out.push({ type: 'stack', tower: live[0], count: 1 });
  return out;
}

function scoreAction(snap: FtAdvisorSnapshot, h: Heights, action: FTAction): number {
  tick();
  if (action.type === 'stack') return evalStack(snap, h, action.tower, action.count);
  if (action.item === 'zero') return evalZero(snap, h, action.target);
  if (action.item === 'secret') return evalSecret(snap, h, action.target, action.count);
  return evalInfo(snap, h, action.targets[0], action.targets[1]);
}

function spendCost(action: FTAction, snap: FtAdvisorSnapshot): number {
  if (action.type === 'stack') {
    if (ftSureCompleteTowers(snap).includes(action.tower)) return 0;
    return action.count;
  }
  if (action.item === 'info') return 20;
  if (action.item === 'zero') return 18;
  return 16;
}

function blended(mix: number, worst: number): number {
  if (worst >= 0.999) return 1;
  return MIX * mix + (1 - MIX) * worst;
}

function pickFromScored(
  scored: Array<{ action: FTAction; mix: number; worst: number }>,
  snap: FtAdvisorSnapshot,
): FtAdvisorPick {
  if (scored.length === 0) {
    const t = incomplete(snap)[0] ?? 'A';
    return { action: { type: 'stack', tower: t, count: 1 }, winRate: 0.5 };
  }
  let best = scored[0]!;
  let bestEv = blended(best.mix, best.worst);
  let bestCost = spendCost(best.action, snap);
  for (const s of scored) {
    const ev = blended(s.mix, s.worst);
    const cost = spendCost(s.action, snap);
    if (ev > bestEv + 1e-9 || (Math.abs(ev - bestEv) <= 1e-9 && cost < bestCost)) {
      best = s;
      bestEv = ev;
      bestCost = cost;
    }
  }
  return { action: best.action, winRate: clamp01(bestEv) };
}

export function pickFiveTowersAdvisor(
  iAmFirst: boolean,
  history: FtAdvisorPly[],
  timeLimitMs: number,
): FtAdvisorPick {
  _deadline = Date.now() + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;

  const snap = ftAdvisorSnapshot(iAmFirst, history);
  if (snap.result.kind !== 'playing') {
    const t = incomplete(snap)[0] ?? 'A';
    return {
      action: { type: 'stack', tower: t, count: 1 },
      winRate: snap.result.kind === 'win' ? 1 : 0,
    };
  }

  const sure = ftSureCompleteTowers(snap);
  if (sure.length > 0) {
    return {
      action: { type: 'stack', tower: sure[0]!, count: 3 },
      winRate: snap.myScore + 1 >= FT_MAX_SCORE ? 1 : 0.92,
    };
  }

  const cands = candidates(snap);
  const acc = cands.map((action) => ({ action, mix: 0, worst: 1, n: 0 }));

  const sampleOnce = () => {
    const h = sampleHeights(snap);
    if (!h) return;
    for (const row of acc) {
      const v = scoreAction(snap, h, row.action);
      row.mix += v;
      row.n += 1;
      if (v < row.worst) row.worst = v;
    }
  };

  sampleOnce();
  _allowTimeout = true;
  while (!_timedOut && Date.now() < _deadline) {
    sampleOnce();
    if (acc[0] && acc[0].n >= 24 && Date.now() > _deadline - 10) break;
  }

  const scored = acc
    .filter((a) => a.n > 0)
    .map((a) => ({ action: a.action, mix: a.mix / a.n, worst: a.worst }));
  const pick = pickFromScored(scored, snap);
  if (
    pick.action.type === 'stack'
    && ftIsKnownGift(snap, pick.action.tower, pick.action.count)
    && sure.length === 0
  ) {
    const t = incomplete(snap)[0] ?? 'A';
    return { action: { type: 'stack', tower: t, count: 1 }, winRate: pick.winRate };
  }

  console.info(
    `[FT advisor] turn=${snap.turn} pick=${actionKey(pick.action)} ev=${pick.winRate.toFixed(3)} nodes=${_nodes}`,
  );
  return pick;
}

function parseMeAction(raw: unknown): FtAdvisorPly['me'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (rec.kind === 'stack') {
    if (!FT_TOWERS.includes(rec.tower as FTTower)) return null;
    if (rec.count !== 1 && rec.count !== 2 && rec.count !== 3) return null;
    return { kind: 'stack', tower: rec.tower as FTTower, count: rec.count };
  }
  if (rec.kind === 'info') {
    if (!Array.isArray(rec.targets) || rec.targets.length !== 2) return null;
    const [a, b] = rec.targets;
    if (!FT_TOWERS.includes(a as FTTower) || !FT_TOWERS.includes(b as FTTower)) return null;
    if (a === b) return null;
    if (typeof rec.sumAtTime !== 'number' || !Number.isInteger(rec.sumAtTime)) return null;
    if (rec.sumAtTime < 0 || rec.sumAtTime > 22) return null;
    return { kind: 'info', targets: [a as FTTower, b as FTTower], sumAtTime: rec.sumAtTime };
  }
  if (rec.kind === 'zero') {
    if (!FT_TOWERS.includes(rec.tower as FTTower)) return null;
    return { kind: 'zero', tower: rec.tower as FTTower };
  }
  if (rec.kind === 'secret') {
    if (!FT_TOWERS.includes(rec.tower as FTTower)) return null;
    if (rec.count !== 1 && rec.count !== 2 && rec.count !== 3) return null;
    return { kind: 'secret', tower: rec.tower as FTTower, count: rec.count };
  }
  return null;
}

function parseOppSight(raw: unknown): FtAdvisorPly['opp'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (rec.kind === 'stack') {
    if (!FT_TOWERS.includes(rec.tower as FTTower)) return null;
    return { kind: 'stack', tower: rec.tower as FTTower };
  }
  if (rec.kind === 'secret-hidden') return { kind: 'secret-hidden' };
  if (rec.kind === 'secret-revealed') {
    if (!FT_TOWERS.includes(rec.tower as FTTower)) return null;
    return { kind: 'secret-revealed', tower: rec.tower as FTTower };
  }
  return null;
}

export function parseAdvisorHistory(raw: unknown): FtAdvisorPly[] | null {
  if (!Array.isArray(raw) || raw.length > 120) return null;
  const out: FtAdvisorPly[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if ('height' in rec) return null;
    if (rec.by !== 'me' && rec.by !== 'opp') return null;
    let half: FTTower | null | undefined = null;
    if (rec.half == null) half = null;
    else if (FT_TOWERS.includes(rec.half as FTTower)) half = rec.half as FTTower;
    else return null;
    let complete: FTTower | null | undefined = null;
    if (rec.complete == null) complete = null;
    else if (FT_TOWERS.includes(rec.complete as FTTower)) complete = rec.complete as FTTower;
    else return null;
    if (rec.by === 'me') {
      const me = parseMeAction(rec.me);
      if (!me) return null;
      out.push({ by: 'me', me, half, complete });
    } else {
      const opp = parseOppSight(rec.opp);
      if (!opp) return null;
      out.push({ by: 'opp', opp, half, complete });
    }
  }
  const snap = ftAdvisorSnapshot(true, out);
  if (snap.result.kind === 'loss' && snap.result.reason.includes('올바르지')) return null;
  return out;
}

export interface FtSuperWorkerRequest {
  iAmFirst: boolean;
  history: FtAdvisorPly[];
  timeLimitMs?: number;
}

export interface FtSuperWorkerResponse extends FtAdvisorPick {}
