export const BNW2_INITIAL_POINTS = 200;
export const BNW2_MAX_SCORE = 10;
export const BNW2_STAGE_UNIT = 20;
export const BNW2_TOTAL_STAGES = 10;

export type BNW2Phase = 'firstSubmit' | 'secondSubmit' | 'reveal' | 'finished';
export type BNW2Color = 'black' | 'white';
export type BNW2WinType = 'score' | 'exhaustion' | 'draw' | 'timeout' | 'leave';

export function calcBNW2Stage(remainingPoints: number): number {
  if (remainingPoints <= 0) return 0;
  return Math.ceil(remainingPoints / BNW2_STAGE_UNIT);
}

export function calcBNW2Color(points: number): BNW2Color {
  return points < 10 ? 'black' : 'white';
}

export interface BNW2PlayerInfo {
  id: string;
  nickname: string;
  score: number;
  stage: number;
  /** 본인에게만 공개. 상대방/관전자는 null */
  remainingPoints: number | null;
  submitted: boolean;
}

export interface BNW2RevealData {
  players: Record<string, {
    color: BNW2Color;
    points: number;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    stageBefore: number;
    stageAfter: number;
  }>;
  winnerId: string | null;
}

export interface BNW2RoundRecord {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    color: BNW2Color;
    points: number;
    scoreChange: number;
    scoreBefore: number;
    scoreAfter: number;
    stageBefore: number;
    stageAfter: number;
  }>;
  winnerId: string | null;
}

export interface BNW2GameData {
  phase: BNW2Phase;
  round: number;
  firstPlayerId: string;
  players: Record<string, BNW2PlayerInfo>;
  /** secondSubmit 페이즈에만 존재. 선플의 제시 전 단계 */
  prevFirstStage: number | null;
  /** secondSubmit 페이즈에만 존재. 선플이 제시한 포인트의 색(흑/백) */
  firstPlayerColor: BNW2Color | null;
  revealData: BNW2RevealData | null;
  roundHistory: BNW2RoundRecord[];
  winner: string | null;
  winType: BNW2WinType | null;
}

export type BNW2Action =
  | { type: 'submitFirst'; points: number }
  | { type: 'submitSecond'; points: number };

export function bnw2StageRange(stage: number): { lo: number; hi: number } {
  if (stage <= 0) return { lo: 0, hi: 0 };
  const s = Math.min(BNW2_TOTAL_STAGES, stage);
  return { lo: (s - 1) * BNW2_STAGE_UNIT + 1, hi: s * BNW2_STAGE_UNIT };
}

/** 표시등 전후 + 색으로 선플 제시 구간. 숨은 정수가 아니라 화면이 주는 범위. */
export function bnw2InferSpendRange(
  stageBefore: number,
  stageAfter: number,
  color: BNW2Color,
): { lo: number; hi: number } {
  const before = bnw2StageRange(stageBefore);
  const after = bnw2StageRange(stageAfter);
  let lo = Math.max(0, before.lo - after.hi);
  let hi = Math.max(lo, before.hi - after.lo);

  if (color === 'black') hi = Math.min(hi, 9);
  else lo = Math.max(lo, 10);

  if (lo > hi) {
    return color === 'black' ? { lo: 0, hi: 9 } : { lo: 10, hi: Math.max(10, hi) };
  }
  return { lo, hi };
}

export function bnw2LegalSpends(
  remBefore: number,
  stageAfter: number,
  color: BNW2Color,
): number[] {
  const { lo, hi } = bnw2InferSpendRange(calcBNW2Stage(remBefore), stageAfter, color);
  const out: number[] = [];
  const maxS = Math.min(hi, Math.max(0, remBefore));
  for (let s = lo; s <= maxS; s++) {
    if (calcBNW2Color(s) !== color) continue;
    if (calcBNW2Stage(remBefore - s) !== stageAfter) continue;
    out.push(s);
  }
  return out;
}

/**
 * 후플 후보. 선이 백(≥10)이면 1~9는 무조건 진다 → 0 아니면 10+.
 */
export function bnw2LegalSecondBids(
  remaining: number,
  firstColor: BNW2Color,
  range: { lo: number; hi: number },
): number[] {
  if (remaining <= 0) return [0];
  const cap = Math.min(remaining, range.hi + 1);
  const minPositive = firstColor === 'white' ? Math.max(10, range.lo) : 1;
  const out = [0];
  if (minPositive <= cap) {
    for (let i = minPositive; i <= cap; i++) out.push(i);
  }
  return out;
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= kk; i++) {
    r = (r * (n - kk + i)) / i;
  }
  return r;
}

function binomAtLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let s = 0;
  for (let x = k; x <= n; x++) {
    s += comb(n, x) * p ** x * (1 - p) ** (n - x);
  }
  return s;
}

function pRace(myNeed: number, oppNeed: number, pRound: number): number {
  if (myNeed <= 0) return 1;
  if (oppNeed <= 0) return 0;
  return binomAtLeast(myNeed, myNeed + oppNeed - 1, pRound);
}

/**
 * 이번 수 이후가 아니라, 지금 점수·연료·선권으로 본 게임 승률.
 * 잔여 0 + 상대 연료 = 상대가 1씩 가져가 10점.
 */
export function bnw2PWinGame(
  myScore: number,
  oppScore: number,
  myRem: number,
  oppRem: number,
  nextIAmFirst: boolean,
): number {
  if (myScore >= BNW2_MAX_SCORE) return 1;
  if (oppScore >= BNW2_MAX_SCORE) return 0;

  const mine = Math.max(0, myRem);
  const theirs = Math.max(0, oppRem);
  const myNeed = BNW2_MAX_SCORE - myScore;
  const oppNeed = BNW2_MAX_SCORE - oppScore;

  if (mine <= 0 && theirs <= 0) {
    if (myScore > oppScore) return 1;
    if (myScore < oppScore) return 0;
    return nextIAmFirst ? 1 : 0;
  }

  if (mine <= 0) {
    const theirFinal = oppScore + Math.min(theirs, oppNeed);
    if (theirFinal >= BNW2_MAX_SCORE) return 0;
    if (myScore > theirFinal) return 1;
    if (myScore < theirFinal) return 0;
    return 0.5;
  }

  if (theirs <= 0) {
    const myFinal = myScore + Math.min(mine, myNeed);
    if (myFinal >= BNW2_MAX_SCORE) return 1;
    if (myFinal > oppScore) return 1;
    if (myFinal < oppScore) return 0;
    return 0.5;
  }

  const myCeil = myScore + mine;
  const oppCeil = oppScore + theirs;
  if (myCeil < BNW2_MAX_SCORE && oppCeil >= BNW2_MAX_SCORE) return 0.02;
  if (oppCeil < BNW2_MAX_SCORE && myCeil >= BNW2_MAX_SCORE) return 0.98;
  if (myCeil < BNW2_MAX_SCORE && oppCeil < BNW2_MAX_SCORE) {
    if (myCeil > oppCeil) return 0.85;
    if (myCeil < oppCeil) return 0.15;
    return 0.5;
  }

  const myFuel = mine / myNeed;
  const oppFuel = theirs / oppNeed;
  let p = myFuel / (myFuel + oppFuel);
  p += nextIAmFirst ? -0.07 : 0.07;
  p = Math.max(0.08, Math.min(0.92, p));
  return pRace(myNeed, oppNeed, p);
}

export const BNW2_ADVISOR_ME = 'me';
export const BNW2_ADVISOR_OPP = 'opp';

export type Bnw2AdvisorWinner = 'me' | 'opp' | 'draw';

/** 실전에서 상대 숫자는 마스킹. 색·불·승패만. */
export interface Bnw2AdvisorRound {
  iWasFirst: boolean;
  myPoints: number;
  oppColor: BNW2Color;
  oppStageAfter: number;
  winner: Bnw2AdvisorWinner;
}

export type Bnw2AdvisorPending = {
  firstColor?: BNW2Color;
  firstStageAfter?: number;
};

export type Bnw2AdvisorAsk = 'first-bid' | 'need-first-color' | 'second-bid' | 'finished';

export type Bnw2AdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface Bnw2AdvisorSide {
  score: number;
  remaining: number;
  stage: number;
}

export interface Bnw2AdvisorSnapshot {
  round: number;
  iAmFirst: boolean;
  my: Bnw2AdvisorSide;
  opp: Bnw2AdvisorSide;
  result: Bnw2AdvisorResult;
  winType: BNW2WinType | null;
}

function advisorSide(score: number, remaining: number): Bnw2AdvisorSide {
  return { score, remaining, stage: calcBNW2Stage(remaining) };
}

function bnw2EmptyBelief(): Float64Array {
  return new Float64Array(BNW2_INITIAL_POINTS + 1);
}

export function bnw2ObserveOppSpend(
  belief: Float64Array,
  stageAfter: number,
  color: BNW2Color,
): Float64Array {
  const next = bnw2EmptyBelief();
  let mass = 0;
  for (let rem = 0; rem <= BNW2_INITIAL_POINTS; rem++) {
    const pRem = belief[rem]!;
    if (pRem <= 0) continue;
    const spends = bnw2LegalSpends(rem, stageAfter, color);
    if (spends.length === 0) continue;
    const w = 1 / spends.length;
    for (const s of spends) {
      const after = rem - s;
      if (after < 0 || after > BNW2_INITIAL_POINTS) continue;
      next[after] += pRem * w;
      mass += pRem * w;
    }
  }
  if (mass <= 1e-15) {
    const { lo, hi } = bnw2StageRange(stageAfter);
    const u = 1 / Math.max(1, hi - lo + 1);
    for (let i = lo; i <= hi; i++) next[i] = u;
    return next;
  }
  for (let i = 0; i < next.length; i++) next[i]! /= mass;
  return next;
}

export function bnw2BeliefFromHistory(history: Bnw2AdvisorRound[]): Float64Array {
  const start = bnw2EmptyBelief();
  start[BNW2_INITIAL_POINTS] = 1;
  let cur = start;
  for (const rec of history) {
    cur = bnw2ObserveOppSpend(cur, rec.oppStageAfter, rec.oppColor);
  }
  return cur;
}

export function bnw2BeliefMean(belief: Float64Array): number {
  let e = 0;
  for (let i = 0; i < belief.length; i++) e += i * belief[i]!;
  return e;
}

export function bnw2AtomsFromBelief(
  belief: Float64Array,
  prevStage: number,
  stageAfter: number,
  color: BNW2Color,
): Array<{ bid: number; remBefore: number; p: number }> {
  const raw: Array<{ bid: number; remBefore: number; p: number }> = [];
  let z = 0;
  for (let rem = 0; rem <= BNW2_INITIAL_POINTS; rem++) {
    const pRem = belief[rem]!;
    if (pRem <= 0) continue;
    if (calcBNW2Stage(rem) !== prevStage) continue;
    const spends = bnw2LegalSpends(rem, stageAfter, color);
    if (spends.length === 0) continue;
    const w = 1 / spends.length;
    for (const bid of spends) {
      const p = pRem * w;
      raw.push({ bid, remBefore: rem, p });
      z += p;
    }
  }
  if (z <= 1e-15) {
    const range = bnw2InferSpendRange(prevStage, stageAfter, color);
    const band = bnw2StageRange(prevStage);
    const remMid = Math.round((band.lo + band.hi) / 2);
    const n = Math.max(1, range.hi - range.lo + 1);
    const out: Array<{ bid: number; remBefore: number; p: number }> = [];
    for (let bid = range.lo; bid <= range.hi; bid++) {
      out.push({ bid, remBefore: remMid, p: 1 / n });
    }
    return out;
  }
  return raw.map((a) => ({ ...a, p: a.p / z }));
}

function sampleIndex(belief: Float64Array, t: number): number {
  let x = t;
  for (let i = 0; i < belief.length; i++) {
    x -= belief[i]!;
    if (x <= 0) return i;
  }
  return Math.round(bnw2BeliefMean(belief));
}

export function bnw2SampleBelief(belief: Float64Array, rng: () => number): number {
  return sampleIndex(belief, rng());
}

function finishByScores(
  myScore: number,
  oppScore: number,
  myRem: number,
  oppRem: number,
  lastIWasFirst: boolean,
): { result: Bnw2AdvisorResult; winType: BNW2WinType } | null {
  if (myScore >= BNW2_MAX_SCORE) {
    return { result: { kind: 'win', reason: '10점 달성' }, winType: 'score' };
  }
  if (oppScore >= BNW2_MAX_SCORE) {
    return { result: { kind: 'loss', reason: '상대 10점' }, winType: 'score' };
  }
  if (myRem > 0 || oppRem > 0) return null;
  if (myScore > oppScore) {
    return { result: { kind: 'win', reason: '포인트 소진' }, winType: 'exhaustion' };
  }
  if (myScore < oppScore) {
    return { result: { kind: 'loss', reason: '포인트 소진' }, winType: 'exhaustion' };
  }
  if (lastIWasFirst) {
    return { result: { kind: 'win', reason: '잔여 0 동점 · 선플 승' }, winType: 'draw' };
  }
  return { result: { kind: 'loss', reason: '잔여 0 동점 · 선플 승' }, winType: 'draw' };
}

export function bnw2AdvisorSnapshot(
  iAmFirstStart: boolean,
  history: Bnw2AdvisorRound[],
): Bnw2AdvisorSnapshot {
  let myScore = 0;
  let oppScore = 0;
  let myRem = BNW2_INITIAL_POINTS;
  let iAmFirst = iAmFirstStart;
  let belief = bnw2BeliefFromHistory([]);

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    myRem = Math.max(0, myRem - rec.myPoints);
    belief = bnw2ObserveOppSpend(belief, rec.oppStageAfter, rec.oppColor);
    if (rec.winner === 'me') {
      myScore += 1;
      iAmFirst = true;
    } else if (rec.winner === 'opp') {
      oppScore += 1;
      iAmFirst = false;
    } else {
      iAmFirst = rec.iWasFirst;
    }

    const oppRem = rec.oppStageAfter <= 0 ? 0 : bnw2BeliefMean(belief);
    const done = finishByScores(myScore, oppScore, myRem, oppRem, rec.iWasFirst);
    if (done) {
      return {
        round: i + 2,
        iAmFirst,
        my: advisorSide(myScore, myRem),
        opp: advisorSide(oppScore, oppRem),
        result: done.result,
        winType: done.winType,
      };
    }
  }

  const oppRem = bnw2BeliefMean(belief);
  return {
    round: history.length + 1,
    iAmFirst,
    my: advisorSide(myScore, myRem),
    opp: advisorSide(oppScore, oppRem),
    result: { kind: 'playing' },
    winType: null,
  };
}

export function bnw2AdvisorAsk(
  iAmFirstStart: boolean,
  history: Bnw2AdvisorRound[],
  pending?: Bnw2AdvisorPending | null,
): Bnw2AdvisorAsk {
  const snap = bnw2AdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') return 'finished';
  if (snap.iAmFirst) return 'first-bid';
  const p = pending ?? {};
  if (p.firstColor == null || p.firstStageAfter == null) return 'need-first-color';
  return 'second-bid';
}

export function bnw2AdvisorFinished(result: Bnw2AdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function bnw2AdvisorWinnerFromResult(result: Bnw2AdvisorResult): Bnw2AdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

/** 상대가 남은 연료로 10점에 못 미치면 이미 잠긴 판. */
export function bnw2AdvisorHopeless(snap: Bnw2AdvisorSnapshot, side: 'my' | 'opp'): boolean {
  const me = side === 'my' ? snap.my : snap.opp;
  const them = side === 'my' ? snap.opp : snap.my;
  const p = bnw2PWinGame(me.score, them.score, me.remaining, them.remaining, side === 'my' ? snap.iAmFirst : !snap.iAmFirst);
  return p <= 0.02;
}

export interface Bnw2AdvisorKifu {
  advisor: true;
  iAmFirstStart: boolean;
  winType: BNW2WinType | null;
  finalScores: Record<string, number>;
  finalPoints: Record<string, number>;
  actions: Array<{
    round: number;
    firstPlayerId: string;
    players: Record<string, {
      nickname: string;
      color: BNW2Color;
      points: number | null;
      scoreChange: number;
      scoreBefore: number;
      scoreAfter: number;
      stageBefore: number;
      stageAfter: number;
      byAi?: boolean;
    }>;
    winnerId: string | null;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildBnw2AdvisorKifu(opts: {
  history: Bnw2AdvisorRound[];
  iAmFirstStart: boolean;
  myNickname: string;
  result: Bnw2AdvisorResult;
  winType: BNW2WinType | null;
}): Bnw2AdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  const actions: Bnw2AdvisorKifu['actions'] = [];
  let myScore = 0;
  let oppScore = 0;
  let myRem = BNW2_INITIAL_POINTS;
  let belief = bnw2BeliefFromHistory([]);
  let oppStage = BNW2_TOTAL_STAGES;

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    const myBefore = myScore;
    const oppBefore = oppScore;
    const myStageBefore = calcBNW2Stage(myRem);
    const oppStageBefore = oppStage;
    myRem = Math.max(0, myRem - rec.myPoints);
    belief = bnw2ObserveOppSpend(belief, rec.oppStageAfter, rec.oppColor);
    oppStage = rec.oppStageAfter;
    let winnerId: string | null = null;
    if (rec.winner === 'me') {
      myScore += 1;
      winnerId = BNW2_ADVISOR_ME;
    } else if (rec.winner === 'opp') {
      oppScore += 1;
      winnerId = BNW2_ADVISOR_OPP;
    }
    actions.push({
      round: i + 1,
      firstPlayerId: rec.iWasFirst ? BNW2_ADVISOR_ME : BNW2_ADVISOR_OPP,
      players: {
        me: {
          nickname: myNick,
          color: calcBNW2Color(rec.myPoints),
          points: rec.myPoints,
          scoreChange: myScore - myBefore,
          scoreBefore: myBefore,
          scoreAfter: myScore,
          stageBefore: myStageBefore,
          stageAfter: calcBNW2Stage(myRem),
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          color: rec.oppColor,
          points: null,
          scoreChange: oppScore - oppBefore,
          scoreBefore: oppBefore,
          scoreAfter: oppScore,
          stageBefore: oppStageBefore,
          stageAfter: rec.oppStageAfter,
        },
      },
      winnerId,
    });
  }

  return {
    advisor: true,
    iAmFirstStart: opts.iAmFirstStart,
    winType: opts.winType,
    finalScores: { me: myScore, opp: oppScore },
    finalPoints: { me: myRem, opp: Math.round(bnw2BeliefMean(belief)) },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}
