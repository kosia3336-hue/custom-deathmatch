import type { DummyAiTier } from '@shared/dummy.js';
import type {
  SBNWAction,
  SBNWPhase,
  SBNWTile,
} from '@shared/types/silper-bnw.js';
import {
  SBNW_INITIAL_TILES,
  SBNW_MAX_SCORE,
  SBNW_TOTAL_ROUNDS,
} from '@shared/types/silper-bnw.js';
import {
  tilesToValue,
  validateTiles,
} from '../../socket/games/silper-bnw/judge.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-010 · multi · 전적 집계 451판, 본경기 선플 약 4250수.
 * COM `firstTiles` 정수로 최소승 만드는 것과 별개. 후플은 자릿수만 본다.
 */

const FIRST_1_W: Record<SBNWTile, number> = { 0: 870, 1: 198, 2: 678, 3: 700, 4: 293 };
const SECOND_1_W: Record<SBNWTile, number> = { 0: 105, 1: 350, 2: 583, 3: 813, 4: 156 };
const FIRST_2: Array<{ tiles: SBNWTile[]; n: number }> = [
  { tiles: [1, 0], n: 566 },
  { tiles: [3, 2], n: 181 },
  { tiles: [2, 1], n: 122 },
  { tiles: [2, 2], n: 74 },
  { tiles: [3, 3], n: 53 },
  { tiles: [4, 0], n: 42 },
  { tiles: [3, 0], n: 40 },
  { tiles: [2, 0], n: 32 },
  { tiles: [1, 2], n: 18 },
  { tiles: [1, 1], n: 14 },
  { tiles: [4, 1], n: 13 },
  { tiles: [4, 2], n: 10 },
  { tiles: [3, 1], n: 10 },
];

export interface SilperDummyRoundRecord {
  round: number;
  rematchIndex: number;
  firstPlayerId: string;
  winnerId: string | null;
  players: Record<
    string,
    {
      digits: number;
      tilesUsed: SBNWTile[];
      valueStr: string;
      scoreBefore: number;
      scoreAfter: number;
      tileCountBefore: number;
      tileCountAfter: number;
    }
  >;
}

export interface SilperDummyView {
  gameOver: boolean;
  phase: SBNWPhase;
  round: number;
  rematchIndex: number;
  myId: string;
  oppId: string;
  firstPlayerId: string;
  my: {
    score: number;
    tiles: Record<SBNWTile, number>;
    tileCount: number;
    submitted: boolean;
  };
  opp: {
    score: number;
    tileCount: number;
    submitted: boolean;
  };
  firstDigits: number | null;
  roundHistory: SilperDummyRoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type Pool = Record<SBNWTile, number>;

function tierKnobs(tier: DummyAiTier): { uniformMix: number; softmaxTemp: number } {
  if (tier === '하') return { uniformMix: 0.4, softmaxTemp: 0.06 };
  if (tier === '중') return { uniformMix: 0.14, softmaxTemp: 0.028 };
  return { uniformMix: 0.04, softmaxTemp: 0.01 };
}

function poolCopy(p: Pool): Pool {
  return { 0: p[0] ?? 0, 1: p[1] ?? 0, 2: p[2] ?? 0, 3: p[3] ?? 0, 4: p[4] ?? 0 };
}

function initialPool(): Pool {
  return poolCopy(SBNW_INITIAL_TILES);
}

function total(p: Pool): number {
  return (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0) + (p[3] ?? 0) + (p[4] ?? 0);
}

function maxTileOf(p: Pool): number {
  for (let t = 4; t >= 0; t--) {
    if ((p[t as SBNWTile] ?? 0) > 0) return t;
  }
  return -1;
}

function consume(p: Pool, tiles: SBNWTile[]): void {
  for (const t of tiles) p[t] -= 1;
}

function hasTiles(p: Pool, tiles: SBNWTile[]): boolean {
  return validateTiles(tiles, p).ok;
}

function keyOf(tiles: SBNWTile[]): string {
  return tiles.join(',');
}

function cheapestFold(p: Pool): SBNWTile[] {
  for (const t of [0, 1, 2, 3, 4] as SBNWTile[]) {
    if ((p[t] ?? 0) > 0) return [t];
  }
  return [];
}

/** 자리 늘리기: 기보에서 10 / 100. 1 다음에 0. */
export function minExtraDigits(p: Pool, digits: number): SBNWTile[] | null {
  if (digits <= 0 || total(p) < digits) return null;
  const local = poolCopy(p);
  const out: SBNWTile[] = [];
  const leadOrder: SBNWTile[] = [1, 2, 3, 4];
  let lead: SBNWTile | null = null;
  for (const t of leadOrder) {
    if (local[t] > 0) {
      lead = t;
      break;
    }
  }
  if (lead == null) return null;
  local[lead] -= 1;
  out.push(lead);
  for (let i = 1; i < digits; i++) {
    let picked: SBNWTile | null = null;
    for (const t of [0, 1, 2, 3, 4] as SBNWTile[]) {
      if (local[t] > 0) {
        picked = t;
        break;
      }
    }
    if (picked == null) return null;
    local[picked] -= 1;
    out.push(picked);
  }
  return out;
}

function maxDigits(p: Pool, digits: number): SBNWTile[] | null {
  if (digits <= 0 || total(p) < digits) return null;
  const local = poolCopy(p);
  const out: SBNWTile[] = [];
  const leadOrder: SBNWTile[] = [4, 3, 2, 1];
  let lead: SBNWTile | null = null;
  for (const t of leadOrder) {
    if (local[t] > 0) {
      lead = t;
      break;
    }
  }
  if (lead == null) return null;
  local[lead] -= 1;
  out.push(lead);
  for (let i = 1; i < digits; i++) {
    let picked: SBNWTile | null = null;
    for (const t of [4, 3, 2, 1, 0] as SBNWTile[]) {
      if (local[t] > 0) {
        picked = t;
        break;
      }
    }
    if (picked == null) return null;
    local[picked] -= 1;
    out.push(picked);
  }
  return out;
}

function maxAll(p: Pool): SBNWTile[] {
  const n = total(p);
  if (n <= 0) return [];
  return maxDigits(p, n) ?? cheapestFold(p);
}

function oneDigit(p: Pool, t: SBNWTile): SBNWTile[] | null {
  if ((p[t] ?? 0) <= 0) return null;
  return [t];
}

function canPlay(p: Pool, tiles: SBNWTile[]): boolean {
  return tiles.length > 0 && hasTiles(p, tiles);
}

function weightedPick<T>(items: Array<{ item: T; w: number }>): T | null {
  const ok = items.filter((x) => x.w > 0);
  if (ok.length === 0) return null;
  let s = 0;
  for (const x of ok) s += x.w;
  let r = Math.random() * s;
  for (const x of ok) {
    r -= x.w;
    if (r <= 0) return x.item;
  }
  return ok[ok.length - 1]!.item;
}

function sampleOneDigit(p: Pool, weights: Record<SBNWTile, number>, uniformMix: number): SBNWTile[] | null {
  const items: Array<{ item: SBNWTile[]; w: number }> = [];
  let uni = 0;
  for (const t of [0, 1, 2, 3, 4] as SBNWTile[]) {
    if ((p[t] ?? 0) > 0) uni += 1;
  }
  if (uni === 0) return null;
  for (const t of [0, 1, 2, 3, 4] as SBNWTile[]) {
    if ((p[t] ?? 0) <= 0) continue;
    const prior = weights[t] ?? 1;
    const w = (1 - uniformMix) * prior + uniformMix * (1 / uni);
    items.push({ item: [t], w });
  }
  return weightedPick(items);
}

function sampleTwoDigit(p: Pool, uniformMix: number): SBNWTile[] | null {
  const items: Array<{ item: SBNWTile[]; w: number }> = [];
  for (const row of FIRST_2) {
    if (hasTiles(p, row.tiles)) items.push({ item: row.tiles, w: (1 - uniformMix) * row.n });
  }
  const extras: SBNWTile[][] = [];
  for (const a of [1, 2, 3, 4] as SBNWTile[]) {
    for (const b of [0, 1, 2, 3, 4] as SBNWTile[]) {
      const tiles: SBNWTile[] = [a, b];
      if (hasTiles(p, tiles)) extras.push(tiles);
    }
  }
  if (extras.length === 0) return minExtraDigits(p, 2);
  const u = uniformMix / extras.length;
  for (const tiles of extras) items.push({ item: tiles, w: u });
  return weightedPick(items) ?? minExtraDigits(p, 2);
}

function samplePlay(p: Pool, digits: number, asFirst: boolean, uniformMix: number): SBNWTile[] | null {
  if (digits <= 0) return null;
  if (digits === 1) return sampleOneDigit(p, asFirst ? FIRST_1_W : SECOND_1_W, uniformMix);
  if (digits === 2) return sampleTwoDigit(p, uniformMix);
  return minExtraDigits(p, digits) ?? maxDigits(p, digits);
}

function sampleOppPoolAfterHistory(
  history: SilperDummyRoundRecord[],
  oppId: string,
  uniformMix: number,
): Pool {
  const p = initialPool();
  for (const r of history) {
    const pd = r.players[oppId];
    if (!pd) continue;
    const d = pd.digits;
    const play = samplePlay(p, d, r.firstPlayerId === oppId, uniformMix);
    if (!play || !hasTiles(p, play)) {
      const fb = cheapestFold(p);
      if (fb.length === 0) break;
      consume(p, fb);
      continue;
    }
    consume(p, play);
  }
  return p;
}

function roundsLeftNow(view: SilperDummyView): number {
  return Math.max(0, SBNW_TOTAL_ROUNDS - view.round + 1);
}

export type SilperScoreRace = 'won' | 'lost' | null;

/**
 * 이번 라운드 포함해서 전승/전패해도 점수 레이스가 끝나면 사고할 필요 없다.
 * 동점 가능(타일 타이브레이크)은 아직 안 끝난 판.
 */
export function silperScoreRace(
  myScore: number,
  oppScore: number,
  roundsLeft: number,
): SilperScoreRace {
  const left = Math.max(0, roundsLeft);
  if (myScore >= SBNW_MAX_SCORE) return 'won';
  if (oppScore >= SBNW_MAX_SCORE) return 'lost';
  if (myScore + left < oppScore) return 'lost';
  if (oppScore + left < myScore) return 'won';
  return null;
}

export function isSilperBnwScoreDecided(view: SilperDummyView): boolean {
  return silperScoreRace(view.my.score, view.opp.score, roundsLeftNow(view)) != null;
}

/** 남은 라운드마다 1장은 남겨야 한다. 이번이 6점이면 예외. */
export function maxSpend(tileCount: number, roundsLeft: number, wouldWinGame: boolean): number {
  if (wouldWinGame) return tileCount;
  if (roundsLeft <= 1) return tileCount;
  return Math.max(1, tileCount - (roundsLeft - 1));
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
  if (myScore >= SBNW_MAX_SCORE) return 1;
  if (oppScore >= SBNW_MAX_SCORE) return 0;
  const mine = total(myPool);
  if (roundsLeft <= 0) {
    if (myScore > oppScore) return 1;
    if (myScore < oppScore) return 0;
    const myMax = maxTileOf(myPool);
    if (myMax > oppMaxEst) return 0.85;
    if (myMax < oppMaxEst) return 0.15;
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
  if (myScore + roundsLeft < SBNW_MAX_SCORE && oppScore + roundsLeft >= SBNW_MAX_SCORE) p -= 0.08;
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
  const myV = tilesToValue(myTiles);
  const oppV = tilesToValue(oppTiles);
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
  const myAfter = poolCopy(myPoolBefore);
  consume(myAfter, myTiles);
  const oppCountAfter = Math.max(0, oppCountBefore - oppTiles.length);
  let oppMax = oppMaxBefore;
  for (const t of oppTiles) {
    if (t === oppMax) {
      oppMax = Math.max(0, oppMax - 1);
      break;
    }
  }
  let p = pWinGame(myS, oppS, myAfter, oppCountAfter, oppMax, roundsLeft - 1, nextFirst);
  if (oppV > myV && myTiles.length > 1) p -= 0.06 * (myTiles.length - 1);
  if (myV > oppV && myTiles.includes(4) && myS < SBNW_MAX_SCORE && roundsLeft > 3) p -= 0.03;
  if (oppV > myV && myTiles.includes(4)) p -= 0.12;
  return Math.max(0, Math.min(1, p));
}

function addCand(out: SBNWTile[][], seen: Set<string>, p: Pool, tiles: SBNWTile[] | null, cap: number): void {
  if (!tiles || tiles.length === 0 || tiles.length > cap) return;
  if (!canPlay(p, tiles)) return;
  const k = keyOf(tiles);
  if (seen.has(k)) return;
  seen.add(k);
  out.push(tiles);
}

/**
 * 후플 후보. 선보다 짧은 수는 접기(가장 싼 1장, 기보는 0)만.
 * 자리 +1은 10/100. 상·중·하 같은 집합.
 */
export function secondCandidates(
  pool: Pool,
  firstDigits: number,
  cap: number,
): SBNWTile[][] {
  const seen = new Set<string>();
  const cands: SBNWTile[][] = [];

  const fold = cheapestFold(pool);
  if (firstDigits >= 2) addCand(cands, seen, pool, fold, cap);

  if (firstDigits === 1) {
    for (const t of [3, 2, 4, 1, 0] as SBNWTile[]) addCand(cands, seen, pool, oneDigit(pool, t), cap);
    addCand(cands, seen, pool, minExtraDigits(pool, 2), cap);
  } else {
    addCand(cands, seen, pool, minExtraDigits(pool, firstDigits), cap);
    addCand(cands, seen, pool, maxDigits(pool, firstDigits), cap);
    if (firstDigits === 2) {
      for (const row of FIRST_2) addCand(cands, seen, pool, row.tiles, cap);
    }
    addCand(cands, seen, pool, minExtraDigits(pool, firstDigits + 1), cap);
  }

  if (cands.length === 0) addCand(cands, seen, pool, fold, cap);
  return cands;
}

function firstCandidates(pool: Pool, cap: number, late: boolean): SBNWTile[][] {
  const seen = new Set<string>();
  const cands: SBNWTile[][] = [];
  for (const t of [0, 3, 2, 4, 1] as SBNWTile[]) addCand(cands, seen, pool, oneDigit(pool, t), cap);
  addCand(cands, seen, pool, minExtraDigits(pool, 2), cap);
  for (const row of FIRST_2.slice(0, 6)) addCand(cands, seen, pool, row.tiles, cap);
  if (late) addCand(cands, seen, pool, maxAll(pool), cap);
  if (cands.length === 0) addCand(cands, seen, pool, cheapestFold(pool), cap);
  return cands;
}

function heuristicSecond(pool: Pool, firstDigits: number, cap: number, needPoint: boolean): SBNWTile[] {
  const fold = cheapestFold(pool);
  if (firstDigits <= 1) {
    for (const t of [3, 2, 4, 1, 0] as SBNWTile[]) {
      const x = oneDigit(pool, t);
      if (x && x.length <= cap && canPlay(pool, x)) return x;
    }
    const plus = minExtraDigits(pool, 2);
    if (plus && plus.length <= cap) return plus;
    return fold;
  }
  if (needPoint) {
    const plus = minExtraDigits(pool, firstDigits + 1);
    if (plus && plus.length <= cap) return plus;
    const same = maxDigits(pool, firstDigits);
    if (same && same.length <= cap) return same;
  }
  if (firstDigits === 2 && !needPoint) {
    const same = minExtraDigits(pool, 2);
    if (same && same.length <= cap && canPlay(pool, same)) {
      const mx = maxDigits(pool, 2);
      if (mx && tilesToValue(mx) > 10n && mx.length <= cap) return mx;
    }
    const plus = minExtraDigits(pool, 3);
    if (plus && plus.length <= cap) return plus;
  }
  if (firstDigits >= 3 && !needPoint) return fold;
  const plus = minExtraDigits(pool, firstDigits + 1);
  if (plus && plus.length <= cap) return plus;
  return fold;
}

function pickFromScores(
  scored: Array<{ tiles: SBNWTile[]; score: number }>,
  tier: DummyAiTier,
  temp: number,
): SBNWTile[] {
  if (scored.length === 0) return [];
  const pool = scored.map((x) => ({
    ...x,
    score: x.score - 0.004 * x.tiles.length - (x.tiles.includes(4) && x.tiles.length === 1 ? 0 : 0),
  }));
  pool.sort((a, b) => b.score - a.score || a.tiles.length - b.tiles.length);
  if (tier === '상') {
    if (pool.length > 1 && Math.random() < 0.05 && pool[0]!.score - pool[1]!.score < 0.02) {
      return pool[1]!.tiles;
    }
    return pool[0]!.tiles;
  }
  const t = Math.max(0.006, temp);
  const maxS = pool[0]!.score;
  const weights = pool.map((x) => Math.exp((x.score - maxS) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!.tiles;
  }
  return pool[pool.length - 1]!.tiles;
}

function clampToLegal(tiles: SBNWTile[], pool: Pool): SBNWTile[] {
  if (validateTiles(tiles, pool).ok) return tiles;
  return cheapestFold(pool);
}

/**
 * 공개 뷰만. firstTiles / 상대 valueStr 금지.
 * 후플: 자릿수 사후 × 기보 성향으로 게임 승률. 짧은 수에 연료 버리지 않음.
 */
export async function pickSilperBnwActionAsync(
  view: SilperDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<SBNWAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  if (view.phase !== 'firstSubmit' && view.phase !== 'secondSubmit') return null;

  const pool = poolCopy(view.my.tiles);
  if (total(pool) <= 0) return null;

  const iAmFirst = view.firstPlayerId === dummyId;
  const race = silperScoreRace(view.my.score, view.opp.score, roundsLeftNow(view));
  if (race != null) {
    const tiles = cheapestFold(pool);
    if (tiles.length === 0) return null;
    await runPsychologySearch(budgetMs, () => {}, { batchSize: 64 });
    if (view.phase === 'firstSubmit') {
      if (!iAmFirst || view.my.submitted) return null;
      return { type: 'submitFirst', tiles };
    }
    if (iAmFirst || view.my.submitted) return null;
    return { type: 'submitSecond', tiles };
  }

  const knobs = tierKnobs(tier);
  const left = roundsLeftNow(view);
  const late = view.round >= 10 || total(pool) <= left;
  const myNeed = SBNW_MAX_SCORE - view.my.score;
  const oppNeed = SBNW_MAX_SCORE - view.opp.score;
  const forceWin = myNeed === 1 || oppNeed === 1;
  const cap = maxSpend(total(pool), left, forceWin && myNeed === 1);

  if (view.phase === 'firstSubmit') {
    if (!iAmFirst || view.my.submitted) return null;
    const cands = firstCandidates(pool, cap, late);
    const acc = new Map<string, { tiles: SBNWTile[]; sum: number; n: number }>();
    for (const tiles of cands) acc.set(keyOf(tiles), { tiles, sum: 0, n: 0 });

    await runPsychologySearch(budgetMs, () => {
      const oppPool = sampleOppPoolAfterHistory(view.roundHistory, view.oppId, knobs.uniformMix);
      for (const tiles of cands) {
        const oppBid = heuristicSecond(
          oppPool,
          tiles.length,
          maxSpend(total(oppPool), left, oppNeed === 1),
          oppNeed === 1 || view.opp.score > view.my.score,
        );
        const oppPlay = canPlay(oppPool, oppBid) ? oppBid : cheapestFold(oppPool);
        const sc = pAfter(
          tiles,
          oppPlay,
          view.my.score,
          view.opp.score,
          pool,
          total(oppPool),
          maxTileOf(oppPool),
          true,
          left,
        );
        const a = acc.get(keyOf(tiles))!;
        a.sum += sc;
        a.n += 1;
      }
    }, { batchSize: 4 });

    const scored = [...acc.values()].map((a) => ({
      tiles: a.tiles,
      score: a.n > 0 ? a.sum / a.n : -1,
    }));
    const tiles = clampToLegal(pickFromScores(scored, tier, knobs.softmaxTemp), pool);
    if (tiles.length === 0) return null;
    return { type: 'submitFirst', tiles };
  }

  if (view.phase === 'secondSubmit') {
    if (iAmFirst || view.my.submitted) return null;
    const firstDigits = view.firstDigits;
    if (firstDigits == null || firstDigits < 1) return null;

    const cands = secondCandidates(pool, firstDigits, cap);
    const acc = new Map<string, { tiles: SBNWTile[]; sum: number; n: number }>();
    for (const tiles of cands) acc.set(keyOf(tiles), { tiles, sum: 0, n: 0 });

    await runPsychologySearch(budgetMs, () => {
      const before = sampleOppPoolAfterHistory(view.roundHistory, view.oppId, knobs.uniformMix);
      const firstPlay = samplePlay(before, firstDigits, true, knobs.uniformMix) ?? minExtraDigits(before, firstDigits);
      if (!firstPlay || !canPlay(before, firstPlay)) return;
      for (const tiles of cands) {
        const sc = pAfter(
          tiles,
          firstPlay,
          view.my.score,
          view.opp.score,
          pool,
          total(before),
          maxTileOf(before),
          false,
          left,
        );
        const a = acc.get(keyOf(tiles))!;
        a.sum += sc;
        a.n += 1;
      }
    }, { batchSize: 8 });

    const scored = [...acc.values()].map((a) => ({
      tiles: a.tiles,
      score: a.n > 0 ? a.sum / a.n : -1,
    }));
    let tiles = clampToLegal(pickFromScores(scored, tier, knobs.softmaxTemp), pool);
    if (tiles.length === 0) tiles = cheapestFold(pool);
    if (firstDigits >= 2 && tiles.length < firstDigits && tiles.length !== 1) {
      tiles = cheapestFold(pool);
    }
    if (firstDigits >= 2 && tiles.includes(4) && tiles.length < firstDigits) {
      tiles = cheapestFold(pool);
    }
    if (tiles.length === 0) return null;
    return { type: 'submitSecond', tiles };
  }

  return null;
}
