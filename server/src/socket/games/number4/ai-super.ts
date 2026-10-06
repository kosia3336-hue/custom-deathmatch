/* 넘버4 슈퍼 자문: 상대 타일은 관측 불가. 흐름 기보 + 전판 승률 + 카운터 혼합. */
import type { NF4Number, Nf4AdvisorRound } from '@shared/types/number4.js';
import {
  TILES_PER_ROUND,
  TOTAL_ROUNDS,
  INITIAL_WHITE,
  INITIAL_BLACK,
} from '@shared/types/number4.js';
import { nf4AdvisorSnapshot } from '@shared/numberFourAdvisor.js';
import { judgeNumber } from './judge.js';
import { flowPolicyBonus, replySeen, replyWeight } from './kifu-prior.js';

export const NF4_SUPER_THINK_MS = 90_000;
const KIFU_MIX = 0.42;
const CLOCK_MASK = 1023;
const MAX_POSTERIOR = 800;
const MAX_EVAL_WORLDS = 64;

export interface Nf4Split {
  w: number;
  b: number;
}

export interface Nf4Stock {
  myW: number;
  myB: number;
  opW: number;
  opB: number;
}

export interface Nf4WeightedStock {
  stock: Nf4Stock;
  weight: number;
}

export interface Nf4AdvisorPick {
  white: number;
  black: number;
  number: NF4Number;
  worlds: number;
  winRate: number;
}

interface OppBranch {
  op: Nf4Split;
  opNum: NF4Number;
  w: number;
  seen: boolean;
  stress: boolean;
}

const REWARDS = [5, 1, 2, 3, 4];

let _deadline = 0;
let _timedOut = false;
let _allowTimeout = true;
let _nodes = 0;
const _memo = new Map<string, number>();

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

export function legalSplits(remW: number, remB: number): Nf4Split[] {
  const rem = remW + remB;
  if (rem <= 0) return [];
  if (rem <= TILES_PER_ROUND) return [{ w: remW, b: remB }];
  const minW = Math.max(0, TILES_PER_ROUND - remB);
  const maxW = Math.min(TILES_PER_ROUND, remW);
  const out: Nf4Split[] = [];
  for (let w = minW; w <= maxW; w++) {
    out.push({ w, b: TILES_PER_ROUND - w });
  }
  return out;
}

function stockKey(s: Nf4Stock): string {
  return `${s.myW},${s.myB},${s.opW},${s.opB}`;
}

function capWeighted(worlds: Nf4WeightedStock[], max: number): Nf4WeightedStock[] {
  if (worlds.length <= max) return worlds;
  return [...worlds].sort((a, b) => b.weight - a.weight).slice(0, max);
}

function applyMyTilesOnly(cur: Nf4WeightedStock[], rec: Nf4AdvisorRound): Nf4WeightedStock[] {
  if (typeof rec.myWhite !== 'number' || typeof rec.myBlack !== 'number') return cur;
  const next = new Map<string, Nf4WeightedStock>();
  for (const world of cur) {
    const s = world.stock;
    if (rec.myWhite > s.myW || rec.myBlack > s.myB) continue;
    const ns: Nf4Stock = {
      myW: s.myW - rec.myWhite,
      myB: s.myB - rec.myBlack,
      opW: s.opW,
      opB: s.opB,
    };
    const k = stockKey(ns);
    const hit = next.get(k);
    if (hit) hit.weight += world.weight;
    else next.set(k, { stock: ns, weight: world.weight });
  }
  return next.size > 0 ? [...next.values()] : cur;
}

/** 공개된 넘버·성공/실패만으로 가능한 남은 장수 세계. 모순이면 내 타일만 차감하고 상대는 유지. */
export function stocksAfter(
  history: Nf4AdvisorRound[],
  maxWorlds = MAX_POSTERIOR,
): Nf4WeightedStock[] {
  let cur: Nf4WeightedStock[] = [
    {
      stock: {
        myW: INITIAL_WHITE,
        myB: INITIAL_BLACK,
        opW: INITIAL_WHITE,
        opB: INITIAL_BLACK,
      },
      weight: 1,
    },
  ];

  for (const rec of history) {
    const next = new Map<string, Nf4WeightedStock>();
    for (const world of cur) {
      const s = world.stock;
      const mine =
        typeof rec.myWhite === 'number' && typeof rec.myBlack === 'number'
          ? [{ w: rec.myWhite, b: rec.myBlack }]
          : legalSplits(s.myW, s.myB);
      for (const my of mine) {
        if (my.w > s.myW || my.b > s.myB) continue;
        for (const op of legalSplits(s.opW, s.opB)) {
          if (judgeNumber(my.w, my.b, op.w, op.b, rec.myNumber).success !== rec.mySuccess) continue;
          if (judgeNumber(op.w, op.b, my.w, my.b, rec.oppNumber).success !== rec.oppSuccess) continue;
          const ns: Nf4Stock = {
            myW: s.myW - my.w,
            myB: s.myB - my.b,
            opW: s.opW - op.w,
            opB: s.opB - op.b,
          };
          const k = stockKey(ns);
          const hit = next.get(k);
          if (hit) hit.weight += world.weight;
          else next.set(k, { stock: ns, weight: world.weight });
        }
      }
    }
    cur = capWeighted(next.size === 0 ? applyMyTilesOnly(cur, rec) : [...next.values()], maxWorlds);
  }
  return cur;
}

function terminalValue(
  myS: number,
  opS: number,
  myN: number,
  opN: number,
  round: number,
): number | null {
  if (myS <= 0 && opS <= 0) {
    if (myN !== opN) return myN < opN ? 1 : 0;
    return 0.5;
  }
  if (myS <= 0) return 0;
  if (opS <= 0) return 1;
  if (round > TOTAL_ROUNDS) {
    if (myS !== opS) return myS > opS ? 1 : 0;
    if (myN !== opN) return myN < opN ? 1 : 0;
    return 0.5;
  }
  return null;
}

function leafEval(
  myS: number,
  opS: number,
  myN: number,
  opN: number,
  round: number,
  stock: Nf4Stock,
): number {
  const left = TOTAL_ROUNDS - round + 1;
  if (left <= 0) return terminalValue(myS, opS, myN, opN, TOTAL_ROUNDS + 1) ?? 0.5;
  const maxGain = left * REWARDS[0];
  const minGain = left * -1;
  if (myS + minGain > opS + maxGain) return 0.97;
  if (opS + minGain > myS + maxGain) return 0.03;

  const avgW = stock.myW / left;
  const avgB = stock.myB / left;
  let tile = 0;
  if (avgW < 1 || avgB < 1) tile -= 0.4;
  if (avgW < 0.5 || avgB < 0.5) tile -= 0.55;

  const score = (myS - opS) * 0.12 - (myN - opN) * 0.02 + tile;
  return 1 / (1 + Math.exp(-score));
}

function resourceAdj(myW: number, myB: number, useW: number, useB: number, leftRounds: number): number {
  const future = leftRounds - 1;
  if (future <= 0) return 0;
  const avgW = (myW - useW) / future;
  const avgB = (myB - useB) / future;
  let p = 0;
  if (avgW < 1 || avgB < 1) p -= 0.07;
  if (avgW < 0.5 || avgB < 0.5) p -= 0.12;
  return p;
}

function branchCap(horizon: number): number {
  if (horizon <= 1) return 320;
  if (horizon === 2) return 40;
  if (horizon === 3) return 16;
  return 10;
}

function collectOppBranches(
  stock: Nf4Stock,
  my: Nf4Split,
  myNum: NF4Number,
  cap: number,
): OppBranch[] {
  const opps = legalSplits(stock.opW, stock.opB);
  if (opps.length === 0) return [];

  const dump = opps.reduce((a, b) => (a.w <= b.w ? a : b));
  const maxWhite = opps.reduce((a, b) => (a.w >= b.w ? a : b));

  const all: OppBranch[] = [];
  for (const op of opps) {
    for (let opNum = 0; opNum <= 4; opNum++) {
      const n = opNum as NF4Number;
      const stress =
        (op.w === dump.w && n === 0) || (op.w === maxWhite.w && (n === 1 || n === 4));
      all.push({
        op,
        opNum: n,
        w: replyWeight(my.w, myNum, op.w, n),
        seen: replySeen(my.w, myNum, op.w, n),
        stress,
      });
    }
  }

  if (all.length <= cap) return all;

  const ranked = [...all].sort((a, b) => {
    const as = (a.seen || a.stress ? 1000 : 0) + a.w;
    const bs = (b.seen || b.stress ? 1000 : 0) + b.w;
    return bs - as;
  });
  return ranked.slice(0, cap);
}

function applyOpp(
  stock: Nf4Stock,
  my: Nf4Split,
  myNum: NF4Number,
  b: OppBranch,
  myS: number,
  opS: number,
  myN: number,
  opN: number,
  round: number,
): {
  stock: Nf4Stock;
  myS: number;
  opS: number;
  myN: number;
  opN: number;
  round: number;
} {
  const jMy = judgeNumber(my.w, my.b, b.op.w, b.op.b, myNum);
  const jOp = judgeNumber(b.op.w, b.op.b, my.w, my.b, b.opNum);
  return {
    stock: {
      myW: stock.myW - my.w,
      myB: stock.myB - my.b,
      opW: stock.opW - b.op.w,
      opB: stock.opB - b.op.b,
    },
    myS: Math.max(0, myS + jMy.scoreChange),
    opS: Math.max(0, opS + jOp.scoreChange),
    myN: myN + myNum,
    opN: opN + b.opNum,
    round: round + 1,
  };
}

function valueFromStock(
  stock: Nf4Stock,
  myS: number,
  opS: number,
  myN: number,
  opN: number,
  round: number,
  horizon: number,
): number {
  tick();
  if (_timedOut) return 0.5;
  const done = terminalValue(myS, opS, myN, opN, round);
  if (done !== null) return done;
  if (horizon <= 0) return leafEval(myS, opS, myN, opN, round, stock);

  const k = `${stockKey(stock)}|${myS}|${opS}|${myN}|${opN}|${round}|${horizon}`;
  const hit = _memo.get(k);
  if (hit !== undefined) return hit;

  let best = -1;
  for (const my of legalSplits(stock.myW, stock.myB)) {
    for (let n = 0; n <= 4; n++) {
      if (_timedOut) break;
      best = Math.max(
        best,
        scorePlanAtStock(stock, my, n as NF4Number, myS, opS, myN, opN, round, horizon),
      );
    }
  }
  const v = best < 0 ? 0.5 : best;
  if (!_timedOut) _memo.set(k, v);
  return v;
}

function scorePlanAtStock(
  stock: Nf4Stock,
  my: Nf4Split,
  myNum: NF4Number,
  myS: number,
  opS: number,
  myN: number,
  opN: number,
  round: number,
  horizon: number,
): number {
  const branches = collectOppBranches(stock, my, myNum, branchCap(horizon));
  if (branches.length === 0) return 0;
  let acc = 0;
  let wsum = 0;
  let worstKifu = 1;
  let hasKifu = false;
  for (const b of branches) {
    if (_timedOut) break;
    const nxt = applyOpp(stock, my, myNum, b, myS, opS, myN, opN, round);
    const v = valueFromStock(
      nxt.stock,
      nxt.myS,
      nxt.opS,
      nxt.myN,
      nxt.opN,
      nxt.round,
      horizon - 1,
    );
    acc += b.w * v;
    wsum += b.w;
    if ((b.seen || b.stress) && v < worstKifu) {
      worstKifu = v;
      hasKifu = true;
    }
  }
  if (wsum <= 0) return 0.5;
  const kifuEv = acc / wsum;
  const brEv = hasKifu ? worstKifu : kifuEv;
  return KIFU_MIX * kifuEv + (1 - KIFU_MIX) * brEv;
}

function scorePlanAtWorlds(
  worlds: Nf4WeightedStock[],
  my: Nf4Split,
  myNum: NF4Number,
  myS: number,
  opS: number,
  myN: number,
  opN: number,
  round: number,
  horizon: number,
): number {
  let acc = 0;
  let wsum = 0;
  for (const world of worlds) {
    if (_timedOut) break;
    if (my.w > world.stock.myW || my.b > world.stock.myB) continue;
    const v = scorePlanAtStock(
      world.stock,
      my,
      myNum,
      myS,
      opS,
      myN,
      opN,
      round,
      horizon,
    );
    acc += world.weight * v;
    wsum += world.weight;
  }
  if (wsum <= 0) return 0.5;
  return acc / wsum;
}

export function parseAdvisorHistory(raw: unknown): Nf4AdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > TOTAL_ROUNDS) return null;
  const out: Nf4AdvisorRound[] = [];
  let leftW = INITIAL_WHITE;
  let leftB = INITIAL_BLACK;
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    const myNumber = rec.myNumber;
    const oppNumber = rec.oppNumber;
    if (typeof myNumber !== 'number' || myNumber < 0 || myNumber > 4 || !Number.isInteger(myNumber)) {
      return null;
    }
    if (typeof oppNumber !== 'number' || oppNumber < 0 || oppNumber > 4 || !Number.isInteger(oppNumber)) {
      return null;
    }
    if (typeof rec.mySuccess !== 'boolean' || typeof rec.oppSuccess !== 'boolean') return null;

    let myWhite: number | undefined;
    let myBlack: number | undefined;
    const hasWhite = rec.myWhite !== undefined && rec.myWhite !== null;
    const hasBlack = rec.myBlack !== undefined && rec.myBlack !== null;
    if (hasWhite !== hasBlack) return null;
    if (hasWhite) {
      if (typeof rec.myWhite !== 'number' || typeof rec.myBlack !== 'number') return null;
      if (!Number.isInteger(rec.myWhite) || !Number.isInteger(rec.myBlack)) return null;
      if (rec.myWhite < 0 || rec.myBlack < 0) return null;
      if (rec.myWhite + rec.myBlack !== TILES_PER_ROUND) return null;
      if (rec.myWhite > leftW || rec.myBlack > leftB) return null;
      myWhite = rec.myWhite;
      myBlack = rec.myBlack;
      leftW -= rec.myWhite;
      leftB -= rec.myBlack;
    }

    out.push({
      myWhite,
      myBlack,
      myNumber: myNumber as NF4Number,
      oppNumber: oppNumber as NF4Number,
      mySuccess: rec.mySuccess,
      oppSuccess: rec.oppSuccess,
    });
  }
  return out;
}

function fallbackPick(worlds: Nf4WeightedStock[]): Nf4AdvisorPick {
  const stock = worlds[0]?.stock ?? {
    myW: INITIAL_WHITE,
    myB: INITIAL_BLACK,
    opW: INITIAL_WHITE,
    opB: INITIAL_BLACK,
  };
  const split = legalSplits(stock.myW, stock.myB)[0] ?? {
    w: Math.min(TILES_PER_ROUND, stock.myW),
    b: Math.max(0, TILES_PER_ROUND - Math.min(TILES_PER_ROUND, stock.myW)),
  };
  return { white: split.w, black: split.b, number: 1, worlds: worlds.length, winRate: 0.5 };
}

export function pickNumberFourAdvisorNumber(
  history: Nf4AdvisorRound[],
  timeLimitMs: number,
  _opts?: { skipFictitious?: boolean },
): Nf4AdvisorPick {
  _deadline = Date.now() + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;
  _memo.clear();

  const snap = nf4AdvisorSnapshot(history);
  const posterior = stocksAfter(history);
  const fallback = fallbackPick(posterior);
  if (snap.result.kind !== 'playing') return fallback;

  const worlds = capWeighted(posterior, MAX_EVAL_WORLDS);
  const round = snap.round;
  const remaining = Math.max(1, TOTAL_ROUNDS - round + 1);
  const myLeftW = snap.tilesKnown ? snap.myWhiteLeft : (worlds[0]?.stock.myW ?? INITIAL_WHITE);
  const myLeftB = snap.tilesKnown ? snap.myBlackLeft : (worlds[0]?.stock.myB ?? INITIAL_BLACK);
  const mySplits = legalSplits(myLeftW, myLeftB);

  let chosen = fallback;
  let completed = 0;

  for (let h = 1; h <= remaining; h++) {
    if (h > 1 && Date.now() >= _deadline) break;
    _timedOut = false;
    _allowTimeout = h > 1;
    _memo.clear();
    let best = fallback;
    let bestEv = -Infinity;
    for (const my of mySplits) {
      for (let n = 0; n <= 4; n++) {
        if (h > 1 && Date.now() >= _deadline) break;
        const searchEv = scorePlanAtWorlds(
          worlds,
          my,
          n as NF4Number,
          snap.myScore,
          snap.oppScore,
          snap.myNumberSum,
          snap.oppNumberSum,
          round,
          h,
        );
        const ev =
          searchEv +
          flowPolicyBonus(history, my.w, n) +
          resourceAdj(myLeftW, myLeftB, my.w, my.b, remaining);
        if (ev > bestEv) {
          bestEv = ev;
          best = {
            white: my.w,
            black: my.b,
            number: n as NF4Number,
            worlds: posterior.length,
            winRate: Math.min(1, Math.max(0, searchEv)),
          };
        }
      }
    }
    if (h === 1 || !_timedOut) {
      chosen = best;
      completed = h;
    }
  }

  console.info(
    `[NF4 advisor] round=${round} worlds=${posterior.length} nodes=${_nodes} horizon=${completed}/${remaining} w=${chosen.white} b=${chosen.black} n=${chosen.number} ev=${chosen.winRate.toFixed(3)}`,
  );

  return chosen;
}

export interface Nf4SuperWorkerRequest {
  history: Nf4AdvisorRound[];
  timeLimitMs?: number;
}

export interface Nf4SuperWorkerResponse {
  white: number;
  black: number;
  number: NF4Number;
  worlds: number;
  winRate: number;
}

export function __resetSuperSearchForTests(): void {
  _memo.clear();
  _timedOut = false;
  _allowTimeout = true;
  _nodes = 0;
}
