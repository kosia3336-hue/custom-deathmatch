/* 배수 흑과 백 슈퍼 자문: 상대 숫자는 관측 불가. 가능 세계 + 전판 승률. COM ai.ts 안 씀. */
import type {
  MBNWTile,
  MBNWTileColor,
  MbnwAdvisorAsk,
  MbnwAdvisorPending,
  MbnwAdvisorRound,
  MbnwCmp,
} from '@shared/types/multiple-bnw.js';
import {
  MBNW_TILE_COLOR,
  MBNW_TILE_SET,
  MBNW_TOTAL_ROUNDS,
  mbnwAdvisorAsk,
  mbnwAdvisorSnapshot,
  mbnwIsColor,
  mbnwIsTile,
  mbnwSettleAdvisorRound,
} from '@shared/types/multiple-bnw.js';
import {
  flowPolicyBonus,
  openWeight,
  replyWeight,
  respondWeight,
  suspectNoWeight,
  suspectYesWeight,
} from './kifu-prior.js';

export const MBNW_SUPER_THINK_MS = 90_000;
const CLOCK_MASK = 1023;
const MAX_WORLDS = 160;

export type MbnwAdvisorPick =
  | { kind: 'tile'; tile: MBNWTile; worlds: number; winRate: number }
  | { kind: 'suspect'; suspect: boolean; worlds: number; winRate: number };

interface World {
  mask: number;
  w: number;
}

interface OppBranch {
  tile: MBNWTile;
  w: number;
}

const FULL_MASK = (1 << MBNW_TILE_SET.length) - 1;

let _deadline = 0;
let _timedOut = false;
let _allowTimeout = true;
let _nodes = 0;
const _memo = new Map<string, number>();
let _history: MbnwAdvisorRound[] = [];
let _worlds: World[] = [{ mask: FULL_MASK, w: 1 }];

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

function tileBit(tile: MBNWTile): number {
  return 1 << MBNW_TILE_SET.indexOf(tile);
}

function tilesFromMask(mask: number): MBNWTile[] {
  return MBNW_TILE_SET.filter((_, i) => (mask & (1 << i)) !== 0);
}

function maskWithout(mask: number, tile: MBNWTile): number {
  return mask & ~tileBit(tile);
}

function oppTileOk(t: MBNWTile, rec: MbnwAdvisorRound): boolean {
  if (MBNW_TILE_COLOR[t] !== rec.oppColor) return false;
  const my = rec.myTile;
  if (rec.iWasFirst) {
    if (rec.mySuccess === true && t % my !== 0) return false;
    if (rec.mySuccess === false && t % my === 0) return false;
    if (rec.oppSuccess === true && my % t !== 0) return false;
    if (rec.oppSuccess === false && my % t === 0) return false;
  } else {
    if (rec.oppSuccess === true && my % t !== 0) return false;
    if (rec.oppSuccess === false && my % t === 0) return false;
    if (rec.mySuccess === true && t % my !== 0) return false;
    if (rec.mySuccess === false && t % my === 0) return false;
  }
  if (rec.cmp === 'me' && !(my > t)) return false;
  if (rec.cmp === 'opp' && !(t > my)) return false;
  if (rec.cmp === 'tie' && t !== my) return false;
  return true;
}

export function worldsAfter(history: MbnwAdvisorRound[], max = MAX_WORLDS): World[] {
  let cur: World[] = [{ mask: FULL_MASK, w: 1 }];
  for (const rec of history) {
    const next = new Map<number, number>();
    for (const world of cur) {
      for (const t of tilesFromMask(world.mask)) {
        if (!oppTileOk(t, rec)) continue;
        const nm = maskWithout(world.mask, t);
        next.set(nm, (next.get(nm) ?? 0) + world.w);
      }
    }
    if (next.size === 0) continue;
    const rows = [...next.entries()].map(([mask, w]) => ({ mask, w }));
    rows.sort((a, b) => b.w - a.w);
    cur = rows.slice(0, max);
  }
  return cur;
}

function mixByWeight(rows: Array<{ w: number; v: number }>): number {
  let acc = 0;
  let wsum = 0;
  for (const r of rows) {
    acc += r.w * r.v;
    wsum += r.w;
  }
  if (wsum <= 0) return 0.5;
  return acc / wsum;
}

function terminalValue(
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
): number | null {
  if (round <= MBNW_TOTAL_ROUNDS) return null;
  if (myS > oppS) return 1;
  if (myS < oppS) return 0;
  if (mySW > oppSW) return 1;
  if (mySW < oppSW) return 0;
  return 0.5;
}

function leafEval(
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
  myMask: number,
  worlds: World[],
): number {
  const done = terminalValue(round, myS, oppS, mySW, oppSW);
  if (done !== null) return done;
  const left = MBNW_TOTAL_ROUNDS - round + 1;
  const myMax = Math.max(0, ...tilesFromMask(myMask));
  let oppMax = 0;
  let wsum = 0;
  for (const world of worlds) {
    const mx = Math.max(0, ...tilesFromMask(world.mask));
    oppMax += mx * world.w;
    wsum += world.w;
  }
  const oppE = wsum > 0 ? oppMax / wsum : 8;
  const sd = Math.max(0.7, Math.sqrt(left));
  const z = (myS - oppS) / sd + 0.18 * (mySW - oppSW) + 0.03 * (myMax - oppE);
  return 1 / (1 + Math.exp(-2.2 * z));
}

function oppBranches(
  worlds: World[],
  color: MBNWTileColor | null,
  myTile: MBNWTile | null,
): OppBranch[] {
  const acc = new Map<MBNWTile, number>();
  for (const world of worlds) {
    for (const t of tilesFromMask(world.mask)) {
      if (color && MBNW_TILE_COLOR[t] !== color) continue;
      let w = world.w;
      if (myTile != null) w += 0.12 * Math.log(1 + replyWeight(myTile, t));
      acc.set(t, (acc.get(t) ?? 0) + w);
    }
  }
  const rows = [...acc.entries()].map(([tile, w]) => ({ tile, w }));
  if (rows.length === 0 && color) {
    for (const t of MBNW_TILE_SET) {
      if (MBNW_TILE_COLOR[t] === color) rows.push({ tile: t, w: 1 });
    }
  }
  return rows;
}

function successProb(
  myTile: MBNWTile,
  oppColor: MBNWTileColor,
  worlds: World[],
): number {
  const rows = oppBranches(worlds, oppColor, myTile);
  let hit = 0;
  let tot = 0;
  for (const b of rows) {
    tot += b.w;
    if (b.tile % myTile === 0) hit += b.w;
  }
  if (tot <= 0) return 0;
  return hit / tot;
}

function oppSuspectProb(oppTile: MBNWTile, myColor: MBNWTileColor): number {
  const y = suspectYesWeight(oppTile, myColor);
  const n = suspectNoWeight(oppTile, myColor);
  return y / (y + n);
}

function applyKnown(
  myTile: MBNWTile,
  oppTile: MBNWTile,
  iAmFirst: boolean,
  mySuspect: boolean,
  oppSuspect: boolean,
): MbnwAdvisorRound {
  const myHit = oppTile % myTile === 0;
  const oppHit = myTile % oppTile === 0;
  let mySuspected = false;
  let mySuccess: boolean | null = null;
  let oppSuspected = false;
  let oppSuccess: boolean | null = null;
  let secondSkipped = false;
  let cmp: MbnwCmp | null = null;

  if (iAmFirst) {
    if (mySuspect) {
      mySuspected = true;
      mySuccess = myHit;
      if (myHit) secondSkipped = true;
    }
    if (!secondSkipped && oppSuspect) {
      oppSuspected = true;
      oppSuccess = oppHit;
    }
  } else {
    if (oppSuspect) {
      oppSuspected = true;
      oppSuccess = oppHit;
      if (oppHit) secondSkipped = true;
    }
    if (!secondSkipped && mySuspect) {
      mySuspected = true;
      mySuccess = myHit;
    }
  }
  if (!mySuccess && !oppSuccess) {
    cmp = myTile > oppTile ? 'me' : oppTile > myTile ? 'opp' : 'tie';
  }
  return {
    iWasFirst: iAmFirst,
    myTile,
    oppColor: MBNW_TILE_COLOR[oppTile],
    mySuspected,
    mySuccess,
    oppSuspected,
    oppSuccess,
    secondSkipped,
    cmp,
  };
}

function afterRoundValue(
  rec: MbnwAdvisorRound,
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
  myMask: number,
  worlds: World[],
  horizon: number,
): number {
  const d = mbnwSettleAdvisorRound(rec);
  const nextMy = myS + d.myDelta;
  const nextOpp = oppS + d.oppDelta;
  const nextMySW = mySW + (d.mySuspectWin ? 1 : 0);
  const nextOppSW = oppSW + (d.oppSuspectWin ? 1 : 0);
  const nextMask = maskWithout(myMask, rec.myTile);
  const nextWorlds = worldsAfter([..._history, rec], 48);
  return valueState(
    round + 1,
    nextMy,
    nextOpp,
    nextMySW,
    nextOppSW,
    nextMask,
    nextWorlds,
    d.nextIAmFirst,
    horizon - 1,
  );
}

function mixRound(
  myTile: MBNWTile,
  iAmFirst: boolean,
  mySuspect: boolean,
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
  myMask: number,
  worlds: World[],
  color: MBNWTileColor | null,
  horizon: number,
): number {
  const branches = oppBranches(worlds, color, myTile);
  if (branches.length === 0) return 0.5;
  return mixByWeight(
    branches.map((b) => {
      const they = oppSuspectProb(b.tile, MBNW_TILE_COLOR[myTile]) >= 0.48;
      const rec = applyKnown(myTile, b.tile, iAmFirst, mySuspect, they);
      return {
        w: b.w,
        v: afterRoundValue(rec, round, myS, oppS, mySW, oppSW, myMask, worlds, horizon),
      };
    }),
  );
}

function valueState(
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
  myMask: number,
  worlds: World[],
  iAmFirst: boolean,
  horizon: number,
): number {
  tick();
  if (_timedOut) return 0.5;
  const done = terminalValue(round, myS, oppS, mySW, oppSW);
  if (done !== null) return done;
  if (horizon <= 0) return leafEval(round, myS, oppS, mySW, oppSW, myMask, worlds);

  const k = `${round}|${myS}|${oppS}|${mySW}|${oppSW}|${myMask}|${iAmFirst ? 1 : 0}|${horizon}`;
  const hit = _memo.get(k);
  if (hit !== undefined) return hit;

  const mine = tilesFromMask(myMask);
  if (mine.length === 0) {
    return leafEval(round, myS, oppS, mySW, oppSW, myMask, worlds);
  }

  let best = -1;
  for (const tile of mine) {
    if (_timedOut) break;
    const pass = mixRound(
      tile,
      iAmFirst,
      false,
      round,
      myS,
      oppS,
      mySW,
      oppSW,
      myMask,
      worlds,
      null,
      horizon,
    );
    const go = mixRound(
      tile,
      iAmFirst,
      true,
      round,
      myS,
      oppS,
      mySW,
      oppSW,
      myMask,
      worlds,
      null,
      horizon,
    );
    best = Math.max(best, pass, go);
  }
  if (best < 0) best = 0.5;
  if (!_timedOut) _memo.set(k, best);
  return best;
}

function scoreTile(
  tile: MBNWTile,
  iAmFirst: boolean,
  color: MBNWTileColor | null,
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
  myMask: number,
  worlds: World[],
  horizon: number,
): number {
  const p = color ? successProb(tile, color, worlds) : 0.35;
  const go = p > 0.02;
  const vNo = mixRound(tile, iAmFirst, false, round, myS, oppS, mySW, oppSW, myMask, worlds, color, horizon);
  const vYes = go
    ? mixRound(tile, iAmFirst, true, round, myS, oppS, mySW, oppSW, myMask, worlds, color, horizon)
    : vNo;
  return Math.max(vNo, vYes);
}

function scoreSuspectChoice(
  tile: MBNWTile,
  iAmFirst: boolean,
  color: MBNWTileColor,
  yes: boolean,
  round: number,
  myS: number,
  oppS: number,
  mySW: number,
  oppSW: number,
  myMask: number,
  worlds: World[],
  horizon: number,
): number {
  const p = successProb(tile, color, worlds);
  if (yes && p <= 0) return -0.05;
  if (!yes && p >= 0.99) return 0.2;
  return mixRound(tile, iAmFirst, yes, round, myS, oppS, mySW, oppSW, myMask, worlds, color, horizon);
}

export function parseAdvisorHistory(raw: unknown): MbnwAdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > MBNW_TOTAL_ROUNDS) return null;
  const out: MbnwAdvisorRound[] = [];
  const seen = new Set<number>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if (typeof rec.iWasFirst !== 'boolean') return null;
    if (!mbnwIsTile(rec.myTile) || seen.has(rec.myTile)) return null;
    if (!mbnwIsColor(rec.oppColor)) return null;
    if (typeof rec.mySuspected !== 'boolean' || typeof rec.oppSuspected !== 'boolean') return null;
    if (typeof rec.secondSkipped !== 'boolean') return null;
    if (rec.mySuccess !== null && rec.mySuccess !== true && rec.mySuccess !== false) return null;
    if (rec.oppSuccess !== null && rec.oppSuccess !== true && rec.oppSuccess !== false) return null;
    if (rec.cmp !== null && rec.cmp !== 'me' && rec.cmp !== 'opp' && rec.cmp !== 'tie') return null;
    seen.add(rec.myTile);
    out.push({
      iWasFirst: rec.iWasFirst,
      myTile: rec.myTile,
      oppColor: rec.oppColor,
      mySuspected: rec.mySuspected,
      mySuccess: rec.mySuccess,
      oppSuspected: rec.oppSuspected,
      oppSuccess: rec.oppSuccess,
      secondSkipped: rec.secondSkipped,
      cmp: rec.cmp,
    });
  }
  return out;
}

export function parsePending(raw: unknown): MbnwAdvisorPending {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: MbnwAdvisorPending = {};
  if (mbnwIsColor(rec.oppColor)) out.oppColor = rec.oppColor;
  if (mbnwIsTile(rec.myTile)) out.myTile = rec.myTile;
  if (rec.firstSuspect === 'none' || rec.firstSuspect === 'success' || rec.firstSuspect === 'fail') {
    out.firstSuspect = rec.firstSuspect;
  }
  return out;
}

function fallbackPick(ask: MbnwAdvisorAsk, tiles: MBNWTile[], pending?: MbnwAdvisorPending): MbnwAdvisorPick {
  const tile = tiles[0] ?? 12;
  if (ask === 'suspect') {
    const color = pending?.oppColor ?? 'black';
    const mine = pending?.myTile ?? tile;
    return { kind: 'suspect', suspect: successProb(mine, color, _worlds) >= 0.5, worlds: _worlds.length, winRate: 0.5 };
  }
  return { kind: 'tile', tile, worlds: _worlds.length, winRate: 0.5 };
}

export function pickMultipleBnwAdvisor(
  iAmFirstStart: boolean,
  history: MbnwAdvisorRound[],
  pending: MbnwAdvisorPending | undefined,
  timeLimitMs: number,
): MbnwAdvisorPick {
  _deadline = Date.now() + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;
  _memo.clear();
  _history = history;
  _worlds = worldsAfter(history);

  const snap = mbnwAdvisorSnapshot(iAmFirstStart, history);
  const ask = mbnwAdvisorAsk(iAmFirstStart, history, pending);
  const fallback = fallbackPick(ask, snap.myTiles, pending);
  if (snap.result.kind !== 'playing' || ask === 'finished' || ask === 'need-opp-color' || ask === 'need-first-suspect') {
    return fallback;
  }

  const round = snap.round;
  const remaining = Math.max(1, MBNW_TOTAL_ROUNDS - round + 1);
  const myMask = snap.myTiles.reduce((m, t) => m | tileBit(t), 0);
  let chosen = fallback;
  let completed = 0;

  for (let h = 1; h <= Math.min(remaining, 3); h++) {
    if (h > 1 && Date.now() >= _deadline) break;
    _timedOut = false;
    _allowTimeout = h > 1;
    _memo.clear();

    let best = fallback;
    let bestEv = -Infinity;

    if (ask === 'tile') {
      const color = snap.iAmFirst ? null : (pending?.oppColor ?? null);
      for (const tile of snap.myTiles) {
        if (h > 1 && Date.now() >= _deadline) break;
        const searchEv = scoreTile(
          tile,
          snap.iAmFirst,
          color,
          round,
          snap.myScore,
          snap.oppScore,
          snap.mySuspectWins,
          snap.oppSuspectWins,
          myMask,
          _worlds,
          h,
        );
        let ev = searchEv + flowPolicyBonus(history, tile, snap.iAmFirst);
        if (history.length === 0 && snap.iAmFirst) ev += 0.04 * Math.log(1 + openWeight(tile));
        if (color) ev += 0.03 * Math.log(1 + respondWeight(color, tile));
        if (ev > bestEv) {
          bestEv = ev;
          best = { kind: 'tile', tile, worlds: _worlds.length, winRate: Math.min(1, Math.max(0, searchEv)) };
        }
      }
    } else {
      const tile = pending?.myTile;
      const color = pending?.oppColor;
      if (!tile || !color) return fallback;
      const p = successProb(tile, color, _worlds);
      for (const yes of [true, false]) {
        if (h > 1 && Date.now() >= _deadline) break;
        const searchEv = scoreSuspectChoice(
          tile,
          snap.iAmFirst,
          color,
          yes,
          round,
          snap.myScore,
          snap.oppScore,
          snap.mySuspectWins,
          snap.oppSuspectWins,
          myMask,
          _worlds,
          h,
        );
        const kifu =
          yes
            ? 0.03 * Math.log(1 + suspectYesWeight(tile, color))
            : 0.03 * Math.log(1 + suspectNoWeight(tile, color));
        let ev = searchEv + kifu;
        if (yes && p <= 0) ev -= 0.4;
        if (!yes && p >= 0.99) ev -= 0.35;
        if (ev > bestEv) {
          bestEv = ev;
          best = { kind: 'suspect', suspect: yes, worlds: _worlds.length, winRate: Math.min(1, Math.max(0, searchEv)) };
        }
      }
    }

    if (h === 1 || !_timedOut) {
      chosen = best;
      completed = h;
    }
  }

  const label =
    chosen.kind === 'tile' ? `tile:${chosen.tile}` : `suspect:${chosen.suspect ? 1 : 0}`;
  console.info(
    `[MBNW advisor] round=${round} ask=${ask} nodes=${_nodes} horizon=${completed} pick=${label} ev=${chosen.winRate.toFixed(3)} worlds=${_worlds.length}`,
  );
  return chosen;
}

export interface MbnwSuperWorkerRequest {
  iAmFirst: boolean;
  history: MbnwAdvisorRound[];
  pending?: MbnwAdvisorPending;
  timeLimitMs?: number;
}

export interface MbnwSuperWorkerResponse extends MbnwAdvisorPick {}

export function __resetMbnwSuperSearchForTests(): void {
  _memo.clear();
  _timedOut = false;
  _allowTimeout = true;
  _nodes = 0;
  _history = [];
  _worlds = [{ mask: FULL_MASK, w: 1 }];
}
