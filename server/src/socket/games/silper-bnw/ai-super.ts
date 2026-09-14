/* 실퍼 슈퍼 자문: 후플은 자릿수만. 한 라운드 EV 금지. 6선승 운영. COM ai.ts 안 씀. */
import type {
  SBNWTile,
  SbnwAdvisorPending,
  SbnwAdvisorRound,
  SbnwAdvisorSnapshot,
} from '@shared/types/silper-bnw.js';
import {
  SBNW_MAX_SCORE,
  sbnwAdvisorAsk,
  sbnwAdvisorHopeless,
  sbnwAdvisorSnapshot,
  sbnwCanSubmit,
  sbnwCheapestFold,
  sbnwConsume,
  sbnwMaxDigits,
  sbnwMaxSpend,
  sbnwMaxTile,
  sbnwMinExtraDigits,
  sbnwPoolCopy,
  sbnwPoolTotal,
  sbnwScoreRace,
  sbnwTilesToValue,
  sbnwValidateTiles,
} from '@shared/types/silper-bnw.js';

export const SBNW_SUPER_THINK_MS = 90_000;
const MIX = 0.5;
const CLOCK_MASK = 255;

export type SbnwAdvisorPick = { tiles: SBNWTile[]; winRate: number };

type Pool = Record<SBNWTile, number>;

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

function keyOf(tiles: SBNWTile[]): string {
  return tiles.join(',');
}

function pWinGame(
  myScore: number,
  oppScore: number,
  myPool: Pool,
  oppCount: number,
  oppMaxEst: number,
  roundsLeft: number,
  nextIAmFirst: boolean,
): number {
  const race = sbnwScoreRace(myScore, oppScore, roundsLeft);
  if (race === 'won') return 1;
  if (race === 'lost') return 0;
  if (myScore >= SBNW_MAX_SCORE) return 1;
  if (oppScore >= SBNW_MAX_SCORE) return 0;
  const mine = sbnwPoolTotal(myPool);
  if (roundsLeft <= 0) {
    if (myScore > oppScore) return 1;
    if (myScore < oppScore) return 0;
    const myMax = sbnwMaxTile(myPool);
    if (myMax > oppMaxEst) return 0.92;
    if (myMax < oppMaxEst) return 0.08;
    return 0.5;
  }
  if (mine <= 0 && oppCount > 0) return myScore > oppScore ? 0.7 : 0.05;
  if (oppCount <= 0 && mine > 0) return myScore >= oppScore ? 0.9 : 0.4;

  const myNeed = SBNW_MAX_SCORE - myScore;
  const oppNeed = SBNW_MAX_SCORE - oppScore;
  const myFuel = mine / myNeed;
  const oppFuel = Math.max(0.5, oppCount) / oppNeed;
  let p = myFuel / (myFuel + oppFuel);
  p += nextIAmFirst ? -0.04 : 0.04;
  p += 0.03 * (sbnwMaxTile(myPool) - oppMaxEst);
  return Math.max(0.05, Math.min(0.95, p));
}

function pAfter(
  myTiles: SBNWTile[],
  oppTiles: SBNWTile[],
  myScore: number,
  oppScore: number,
  myPoolBefore: Pool,
  oppCountBefore: number,
  oppMaxBefore: number,
  iAmFirst: boolean,
  roundsLeft: number,
): number {
  const myV = sbnwTilesToValue(myTiles);
  const oppV = sbnwTilesToValue(oppTiles);
  let myS = myScore;
  let oppS = oppScore;
  let nextFirst = iAmFirst;
  if (myV > oppV) {
    myS += 1;
    nextFirst = true;
  } else if (oppV > myV) {
    oppS += 1;
    nextFirst = false;
  }
  const myAfter = sbnwConsume(myPoolBefore, myTiles);
  const oppCountAfter = Math.max(0, oppCountBefore - oppTiles.length);
  let oppMax = oppMaxBefore;
  for (const t of oppTiles) {
    if (t === oppMax) {
      oppMax = Math.max(0, oppMax - 1);
      break;
    }
  }
  let p = pWinGame(myS, oppS, myAfter, oppCountAfter, oppMax, roundsLeft - 1, nextFirst);
  if (oppV > myV && myTiles.length > 1) p -= 0.07 * (myTiles.length - 1);
  if (myV > oppV && myTiles.includes(4) && myS < SBNW_MAX_SCORE && roundsLeft > 3) p -= 0.04;
  if (oppV > myV && myTiles.includes(4)) p -= 0.18;
  if (myTiles.length === 1 && myTiles[0] === 4 && myV <= oppV) p -= 0.15;
  return clamp01(p);
}

function addCand(out: SBNWTile[][], seen: Set<string>, p: Pool, tiles: SBNWTile[] | null, cap: number): void {
  if (!tiles || tiles.length === 0 || tiles.length > cap) return;
  if (!sbnwValidateTiles(tiles, p)) return;
  const k = keyOf(tiles);
  if (seen.has(k)) return;
  seen.add(k);
  out.push(tiles);
}

function oneDigit(p: Pool, t: SBNWTile): SBNWTile[] | null {
  if ((p[t] ?? 0) <= 0) return null;
  return [t];
}

const FIRST_2: SBNWTile[][] = [
  [1, 0], [2, 0], [3, 0], [4, 0],
  [2, 1], [3, 2], [1, 1], [2, 2], [3, 3],
];

export function sbnwSecondCandidates(
  pool: Pool,
  firstDigits: number,
  cap: number,
  stretch: boolean,
): SBNWTile[][] {
  const seen = new Set<string>();
  const cands: SBNWTile[][] = [];
  const fold = sbnwCheapestFold(pool);
  if (firstDigits >= 2) addCand(cands, seen, pool, fold, cap);

  if (firstDigits === 1) {
    for (const t of [3, 2, 1, 0, 4] as SBNWTile[]) addCand(cands, seen, pool, oneDigit(pool, t), cap);
    addCand(cands, seen, pool, sbnwMinExtraDigits(pool, 2), cap);
  } else if (firstDigits === 2) {
    addCand(cands, seen, pool, sbnwMinExtraDigits(pool, 2), cap);
    for (const row of FIRST_2) {
      if (!stretch && row.includes(4)) continue;
      addCand(cands, seen, pool, row, cap);
    }
    if (stretch) {
      addCand(cands, seen, pool, sbnwMaxDigits(pool, 2), cap);
      addCand(cands, seen, pool, sbnwMinExtraDigits(pool, 3), cap);
    }
  } else if (stretch) {
    addCand(cands, seen, pool, sbnwMinExtraDigits(pool, firstDigits + 1), cap);
    addCand(cands, seen, pool, sbnwMaxDigits(pool, firstDigits), cap);
  }
  if (cands.length === 0) addCand(cands, seen, pool, fold, cap);
  return cands;
}

function firstCandidates(pool: Pool, cap: number, late: boolean): SBNWTile[][] {
  const seen = new Set<string>();
  const cands: SBNWTile[][] = [];
  const singles: SBNWTile[] = late ? [3, 2, 1, 0, 4] : [3, 2, 1, 0];
  for (const t of singles) addCand(cands, seen, pool, oneDigit(pool, t), cap);
  addCand(cands, seen, pool, sbnwMinExtraDigits(pool, 2), cap);
  for (const row of FIRST_2) {
    if (!late && row.includes(4)) continue;
    addCand(cands, seen, pool, row, cap);
  }
  if (late) {
    addCand(cands, seen, pool, sbnwMaxDigits(pool, Math.min(cap, sbnwPoolTotal(pool))), cap);
  }
  if (cands.length === 0) addCand(cands, seen, pool, sbnwCheapestFold(pool), cap);
  return cands;
}

function playsOfLength(pool: Pool, digits: number, limit: number): SBNWTile[][] {
  if (digits <= 0 || sbnwPoolTotal(pool) < digits) return [];
  if (digits >= 4) {
    const out: SBNWTile[][] = [];
    const a = sbnwMinExtraDigits(pool, digits);
    const b = sbnwMaxDigits(pool, digits);
    if (a) out.push(a);
    if (b && keyOf(b) !== (a ? keyOf(a) : '')) out.push(b);
    return out;
  }
  const out: SBNWTile[][] = [];
  const seen = new Set<string>();
  const rec = (p: Pool, acc: SBNWTile[]) => {
    if (out.length >= limit) return;
    if (acc.length === digits) {
      const k = keyOf(acc);
      if (!seen.has(k)) {
        seen.add(k);
        out.push([...acc]);
      }
      return;
    }
    const order: SBNWTile[] = acc.length === 0 ? [1, 2, 3, 4, 0] : [0, 1, 2, 3, 4];
    for (const t of order) {
      if (acc.length === 0 && digits >= 2 && t === 0) continue;
      if ((p[t] ?? 0) <= 0) continue;
      p[t]--;
      acc.push(t);
      rec(p, acc);
      acc.pop();
      p[t]++;
      if (out.length >= limit) return;
    }
  };
  rec(sbnwPoolCopy(pool), []);
  return out;
}

function blended(mix: number, worst: number): number {
  if (worst >= 0.999) return 1;
  return MIX * mix + (1 - MIX) * worst;
}

function heuristicSecond(pool: Pool, firstDigits: number, cap: number, needPoint: boolean): SBNWTile[] {
  const fold = sbnwCheapestFold(pool);
  if (firstDigits <= 1) {
    for (const t of [3, 2, 1, 0] as SBNWTile[]) {
      const x = oneDigit(pool, t);
      if (x && x.length <= cap && sbnwValidateTiles(x, pool)) return x;
    }
    const plus = sbnwMinExtraDigits(pool, 2);
    if (plus && plus.length <= cap) return plus;
    return fold;
  }
  if (needPoint) {
    const plus = sbnwMinExtraDigits(pool, firstDigits + 1);
    if (plus && plus.length <= cap) return plus;
    const same = sbnwMaxDigits(pool, firstDigits);
    if (same && same.length <= cap) return same;
  }
  if (firstDigits >= 3 && !needPoint) return fold;
  if (firstDigits === 2 && !needPoint) {
    const same = sbnwMinExtraDigits(pool, 2);
    if (same && same.length <= cap) return same;
    const plus = sbnwMinExtraDigits(pool, 3);
    if (plus && plus.length <= cap) return plus;
  }
  const plus = sbnwMinExtraDigits(pool, firstDigits + 1);
  if (plus && plus.length <= cap) return plus;
  return fold;
}

function scoreSecond(
  myTiles: SBNWTile[],
  atoms: SBNWTile[][],
  snap: SbnwAdvisorSnapshot,
): number {
  tick();
  if (atoms.length === 0) return 0.5;
  const p = 1 / atoms.length;
  let mix = 0;
  let worst = 1;
  for (const atom of atoms) {
    const v = pAfter(
      myTiles,
      atom,
      snap.my.score,
      snap.opp.score,
      snap.my.tiles,
      snap.opp.tileCount,
      sbnwMaxTile(snap.opp.tiles),
      false,
      snap.roundsLeft,
    );
    mix += p * v;
    if (v < worst) worst = v;
  }
  return blended(mix, worst);
}

function oppBestVsDigits(
  oppPool: Pool,
  myDigits: number,
  snap: SbnwAdvisorSnapshot,
  myAtoms: SBNWTile[][],
): SBNWTile[] {
  const cap = sbnwMaxSpend(
    sbnwPoolTotal(oppPool),
    snap.roundsLeft,
    SBNW_MAX_SCORE - snap.opp.score === 1,
  );
  const cands = sbnwSecondCandidates(
    oppPool,
    myDigits,
    cap,
    SBNW_MAX_SCORE - snap.opp.score === 1,
  );
  if (cands.length === 0) return sbnwCheapestFold(oppPool);
  if (myAtoms.length === 0) {
    return heuristicSecond(oppPool, myDigits, cap, SBNW_MAX_SCORE - snap.opp.score === 1);
  }
  let best = cands[0]!;
  let bestTheir = -Infinity;
  const w = 1 / myAtoms.length;
  for (const bid of cands) {
    tick();
    let their = 0;
    for (const atom of myAtoms) {
      const our = pAfter(
        atom,
        bid,
        snap.my.score,
        snap.opp.score,
        snap.my.tiles,
        snap.opp.tileCount,
        sbnwMaxTile(snap.opp.tiles),
        true,
        snap.roundsLeft,
      );
      their += w * (1 - our);
    }
    if (their > bestTheir + 1e-12 || (Math.abs(their - bestTheir) <= 1e-12 && bid.length < best.length)) {
      bestTheir = their;
      best = bid;
    }
  }
  return best;
}

function scoreFirst(myTiles: SBNWTile[], snap: SbnwAdvisorSnapshot, atomLimit: number): number {
  tick();
  const myAtoms = playsOfLength(snap.my.tiles, myTiles.length, atomLimit);
  const mixBid = oppBestVsDigits(snap.opp.tiles, myTiles.length, snap, myAtoms);
  const oppCands = sbnwSecondCandidates(
    snap.opp.tiles,
    myTiles.length,
    sbnwMaxSpend(snap.opp.tileCount, snap.roundsLeft, SBNW_MAX_SCORE - snap.opp.score === 1),
    SBNW_MAX_SCORE - snap.opp.score === 1,
  );
  let worstBid = mixBid;
  let worst = 1;
  for (const bid of oppCands) {
    const v = pAfter(
      myTiles,
      bid,
      snap.my.score,
      snap.opp.score,
      snap.my.tiles,
      snap.opp.tileCount,
      sbnwMaxTile(snap.opp.tiles),
      true,
      snap.roundsLeft,
    );
    if (v < worst - 1e-12 || (Math.abs(v - worst) <= 1e-12 && bid.length < worstBid.length)) {
      worst = v;
      worstBid = bid;
    }
  }
  const mix = pAfter(
    myTiles,
    mixBid,
    snap.my.score,
    snap.opp.score,
    snap.my.tiles,
    snap.opp.tileCount,
    sbnwMaxTile(snap.opp.tiles),
    true,
    snap.roundsLeft,
  );
  const w = pAfter(
    myTiles,
    worstBid,
    snap.my.score,
    snap.opp.score,
    snap.my.tiles,
    snap.opp.tileCount,
    sbnwMaxTile(snap.opp.tiles),
    true,
    snap.roundsLeft,
  );
  return blended(mix, w);
}

function spendCost(tiles: SBNWTile[], snap: SbnwAdvisorSnapshot): number {
  let c = tiles.length * 10;
  if (tiles.includes(4)) c += snap.roundsLeft > 3 ? 40 : 8;
  if (tiles.length === 1 && tiles[0] === 0) c -= 2;
  return c;
}

function pickFromScored(
  scored: Array<{ tiles: SBNWTile[]; ev: number }>,
  snap: SbnwAdvisorSnapshot,
): SbnwAdvisorPick {
  if (scored.length === 0) {
    return { tiles: sbnwCheapestFold(snap.my.tiles), winRate: 0.5 };
  }
  let best = scored[0]!;
  let bestCost = spendCost(best.tiles, snap);
  for (const s of scored) {
    const cost = spendCost(s.tiles, snap);
    if (s.ev > best.ev + 1e-9 || (Math.abs(s.ev - best.ev) <= 1e-9 && cost < bestCost)) {
      best = s;
      bestCost = cost;
    }
  }
  return { tiles: best.tiles, winRate: clamp01(best.ev) };
}

function lockedDump(snap: SbnwAdvisorSnapshot): SbnwAdvisorPick | null {
  const race = sbnwScoreRace(snap.my.score, snap.opp.score, snap.roundsLeft);
  if (race === 'won' || sbnwAdvisorHopeless(snap, 'opp')) {
    return { tiles: sbnwCheapestFold(snap.my.tiles), winRate: 1 };
  }
  if (race === 'lost' || sbnwAdvisorHopeless(snap, 'my')) {
    return { tiles: sbnwCheapestFold(snap.my.tiles), winRate: 0 };
  }
  return null;
}

function pickFirst(snap: SbnwAdvisorSnapshot, wide: boolean): SbnwAdvisorPick {
  if (!sbnwCanSubmit(snap.my.tiles)) return { tiles: [], winRate: 0 };
  const locked = lockedDump(snap);
  if (locked) return locked;
  const forceWin = SBNW_MAX_SCORE - snap.my.score === 1 || SBNW_MAX_SCORE - snap.opp.score === 1;
  const cap = sbnwMaxSpend(snap.my.tileCount, snap.roundsLeft, forceWin && SBNW_MAX_SCORE - snap.my.score === 1);
  const late = snap.round >= 10 || snap.my.tileCount <= snap.roundsLeft;
  const cands = firstCandidates(snap.my.tiles, cap, late || wide);
  const atomLimit = wide ? 40 : 16;
  const scored: Array<{ tiles: SBNWTile[]; ev: number }> = [];
  for (const tiles of cands) {
    if (_timedOut && scored.length > 0) break;
    scored.push({ tiles, ev: scoreFirst(tiles, snap, atomLimit) });
  }
  return pickFromScored(scored, snap);
}

function pickSecond(snap: SbnwAdvisorSnapshot, firstDigits: number, wide: boolean): SbnwAdvisorPick {
  if (!sbnwCanSubmit(snap.my.tiles)) return { tiles: [], winRate: 0 };
  const locked = lockedDump(snap);
  if (locked) return locked;
  const forceWin = SBNW_MAX_SCORE - snap.my.score === 1 || SBNW_MAX_SCORE - snap.opp.score === 1;
  const cap = sbnwMaxSpend(snap.my.tileCount, snap.roundsLeft, forceWin && SBNW_MAX_SCORE - snap.my.score === 1);
  const cands = sbnwSecondCandidates(snap.my.tiles, firstDigits, cap, forceWin);
  const atomLimit = wide ? 48 : 20;
  const atoms = playsOfLength(snap.opp.tiles, firstDigits, atomLimit);
  const scored: Array<{ tiles: SBNWTile[]; ev: number }> = [];
  for (const tiles of cands) {
    if (_timedOut && scored.length > 0) break;
    scored.push({ tiles, ev: scoreSecond(tiles, atoms, snap) });
  }
  const pick = pickFromScored(scored, snap);
  if (firstDigits >= 2 && pick.tiles.length < firstDigits && pick.tiles.length !== 1) {
    return { tiles: sbnwCheapestFold(snap.my.tiles), winRate: pick.winRate };
  }
  if (firstDigits >= 2 && pick.tiles.includes(4) && pick.tiles.length < firstDigits) {
    return { tiles: sbnwCheapestFold(snap.my.tiles), winRate: pick.winRate };
  }
  return pick;
}

export function pickSilperBnwAdvisor(
  iAmFirstStart: boolean,
  history: SbnwAdvisorRound[],
  pending: SbnwAdvisorPending | null | undefined,
  timeLimitMs: number,
): SbnwAdvisorPick {
  _deadline = Date.now() + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;

  const snap = sbnwAdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') {
    const winRate = snap.result.kind === 'win' ? 1 : snap.result.kind === 'loss' ? 0 : 0.5;
    return { tiles: sbnwCheapestFold(snap.my.tiles), winRate };
  }

  const ask = sbnwAdvisorAsk(iAmFirstStart, history, pending);
  let chosen: SbnwAdvisorPick = { tiles: sbnwCheapestFold(snap.my.tiles), winRate: 0.5 };
  if (ask === 'first-bid') {
    chosen = pickFirst(snap, false);
  } else if (ask === 'second-bid' && pending?.firstDigits != null) {
    chosen = pickSecond(snap, pending.firstDigits, false);
  } else {
    return chosen;
  }

  _allowTimeout = true;
  if (Date.now() < _deadline) {
    _timedOut = false;
    const wide = ask === 'first-bid'
      ? pickFirst(snap, true)
      : pickSecond(snap, pending?.firstDigits ?? 1, true);
    if (!_timedOut) chosen = wide;
  }

  console.info(
    `[SBNW advisor] r=${snap.round} first=${snap.iAmFirst} pick=${keyOf(chosen.tiles)} ev=${chosen.winRate.toFixed(3)} nodes=${_nodes}`,
  );
  return chosen;
}

function parseTiles(raw: unknown): SBNWTile[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 19) return null;
  const out: SBNWTile[] = [];
  for (const t of raw) {
    if (t !== 0 && t !== 1 && t !== 2 && t !== 3 && t !== 4) return null;
    out.push(t);
  }
  return out;
}

export function parseAdvisorHistory(raw: unknown): SbnwAdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > 80) return null;
  const out: SbnwAdvisorRound[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if (typeof rec.iWasFirst !== 'boolean') return null;
    if (typeof rec.rematchIndex !== 'number' || !Number.isInteger(rec.rematchIndex)) return null;
    if (rec.rematchIndex < 0 || rec.rematchIndex > 5) return null;
    const myTiles = parseTiles(rec.myTiles);
    const oppTiles = parseTiles(rec.oppTiles);
    if (!myTiles || !oppTiles) return null;
    out.push({ rematchIndex: rec.rematchIndex, iWasFirst: rec.iWasFirst, myTiles, oppTiles });
  }
  const snap = sbnwAdvisorSnapshot(out[0]?.iWasFirst ?? true, out);
  if (snap.result.kind === 'loss' && snap.result.reason === '기록 타일이 올바르지 않음') return null;
  return out;
}

export function parsePending(raw: unknown): SbnwAdvisorPending {
  if (raw == null || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  if (typeof rec.firstDigits === 'number' && Number.isInteger(rec.firstDigits)) {
    if (rec.firstDigits >= 1 && rec.firstDigits <= 19) return { firstDigits: rec.firstDigits };
  }
  return {};
}

export interface SbnwSuperWorkerRequest {
  iAmFirst: boolean;
  history: SbnwAdvisorRound[];
  pending?: SbnwAdvisorPending;
  timeLimitMs?: number;
}

export interface SbnwSuperWorkerResponse extends SbnwAdvisorPick {}
