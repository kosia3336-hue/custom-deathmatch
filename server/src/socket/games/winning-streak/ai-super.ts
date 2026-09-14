/* 연승 슈퍼 자문: 잔여는 공개. 한 라운드 EV 금지. 남은 판 최대연승→총승. COM ai.ts 안 씀. */
import type { WSCardCount, WSCardType, WsAdvisorRound } from '@shared/types/winning-streak.js';
import {
  CARD_TYPES,
  WS_MATCHUP,
  wsAdvisorHopeless,
  wsAdvisorSnapshot,
  wsLegalCards,
  type WsAdvisorSnapshot,
} from '@shared/types/winning-streak.js';

export const WS_SUPER_THINK_MS = 90_000;
const CLOCK_MASK = 1023;
const MIX = 0.5;

const I_SPADE = 0;
const I_DIAMOND = 1;
const I_HEART = 2;
const I_CLUB = 3;
const I_BLACK = 4;
const I_COLOR = 5;

const MATCH: number[][] = CARD_TYPES.map((a) =>
  CARD_TYPES.map((b) => {
    const r = WS_MATCHUP[a][b];
    if (r === 'win') return 1;
    if (r === 'draw_win') return 2;
    if (r === 'draw_lose') return 3;
    return 0;
  }),
);

export type WsAdvisorPick = { card: WSCardType; winRate: number };

interface Packed {
  my: number[];
  opp: number[];
  myLast: number;
  oppLast: number;
  mySt: number;
  oppSt: number;
  myMax: number;
  oppMax: number;
  myW: number;
  oppW: number;
  left: number;
}

let _deadline = 0;
let _timedOut = false;
let _allowTimeout = true;
let _nodes = 0;
const _memo = new Map<string, number>();

function tick(): void {
  _nodes++;
  if (_allowTimeout && (_nodes & CLOCK_MASK) === 0 && Date.now() >= _deadline) _timedOut = true;
}

function toArr(c: WSCardCount): number[] {
  return [c.spade, c.diamond, c.heart, c.club, c.blackJoker, c.colorJoker];
}

function lastCode(card: WSCardType | null): number {
  if (!card) return 0;
  return CARD_TYPES.indexOf(card) + 1;
}

function fromSnap(snap: WsAdvisorSnapshot): Packed {
  return {
    my: toArr(snap.my.remaining),
    opp: toArr(snap.opp.remaining),
    myLast: lastCode(snap.my.lastPlayed),
    oppLast: lastCode(snap.opp.lastPlayed),
    mySt: snap.my.currentStreak,
    oppSt: snap.opp.currentStreak,
    myMax: snap.my.maxStreak,
    oppMax: snap.opp.maxStreak,
    myW: snap.my.totalWins,
    oppW: snap.opp.totalWins,
    left: snap.left,
  };
}

function cloneArr(a: number[]): number[] {
  return [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!];
}

function legal(counts: number[], last: number): number[] {
  const locked = last > 0 ? last - 1 : -1;
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (counts[i]! <= 0) continue;
    if (i === locked) continue;
    out.push(i);
  }
  if (out.length === 0 && locked >= 0 && counts[locked]! > 0) out.push(locked);
  return out;
}

function isStuck(counts: number[], last: number): boolean {
  if (last <= 0) return false;
  const locked = last - 1;
  if (counts[locked]! <= 0) return false;
  for (let i = 0; i < 6; i++) {
    if (i === locked) continue;
    if (counts[i]! > 0) return false;
  }
  return true;
}

function outcome(myMax: number, oppMax: number, myW: number, oppW: number): number {
  if (myMax !== oppMax) return myMax > oppMax ? 1 : 0;
  if (myW !== oppW) return myW > oppW ? 1 : 0;
  return 0.5;
}

function lockValue(s: Packed): number | null {
  if (s.left <= 0) return outcome(s.myMax, s.oppMax, s.myW, s.oppW);
  const myBest = Math.max(s.myMax, s.mySt + s.left);
  const oppBest = Math.max(s.oppMax, s.oppSt + s.left);
  if (s.myMax > oppBest) return 1;
  if (s.oppMax > myBest) return 0;
  if (myBest === s.myMax && oppBest === s.oppMax && s.myMax === s.oppMax) {
    if (s.myW > s.oppW + s.left) return 1;
    if (s.oppW > s.myW + s.left) return 0;
  }
  return null;
}

function leafEval(s: Packed): number {
  const locked = lockValue(s);
  if (locked !== null) return locked;
  const myColor = s.my[I_COLOR]! > 0 ? 1 : 0;
  const oppColor = s.opp[I_COLOR]! > 0 ? 1 : 0;
  const myBlackDump = s.my[I_BLACK]! > 0 && s.mySt === 0 ? 1 : 0;
  const z =
    2.5 * (s.myMax - s.oppMax)
    + 0.65 * (s.mySt - s.oppSt)
    + 0.16 * (s.myW - s.oppW)
    + 0.7 * (myColor - oppColor)
    + 0.08 * myBlackDump
    + 0.04 * (s.left > 0 ? (s.my[I_HEART]! + s.my[I_SPADE]! - s.opp[I_HEART]! - s.opp[I_SPADE]!) : 0);
  return 1 / (1 + Math.exp(-1.85 * z));
}

function applyWin(
  st: number,
  max: number,
  wins: number,
  code: number,
): { st: number; max: number; wins: number } {
  if (code === 1 || code === 2) {
    const next = st + 1;
    return { st: next, max: next > max ? next : max, wins: wins + 1 };
  }
  return { st: 0, max, wins };
}

function applyMove(s: Packed, myI: number, oppI: number): Packed {
  const my = cloneArr(s.my);
  const opp = cloneArr(s.opp);
  my[myI]!--;
  opp[oppI]!--;
  const mine = applyWin(s.mySt, s.myMax, s.myW, MATCH[myI]![oppI]!);
  const theirs = applyWin(s.oppSt, s.oppMax, s.oppW, MATCH[oppI]![myI]!);
  return {
    my,
    opp,
    myLast: myI + 1,
    oppLast: oppI + 1,
    mySt: mine.st,
    oppSt: theirs.st,
    myMax: mine.max,
    oppMax: theirs.max,
    myW: mine.wins,
    oppW: theirs.wins,
    left: s.left - 1,
  };
}

function afterValue(s: Packed, horizon: number): number {
  if (s.left <= 0) return outcome(s.myMax, s.oppMax, s.myW, s.oppW);
  const meStuck = isStuck(s.my, s.myLast);
  const oppStuck = isStuck(s.opp, s.oppLast);
  if (meStuck || oppStuck) {
    if (meStuck && oppStuck) return outcome(s.myMax, s.oppMax, s.myW, s.oppW);
    return meStuck ? 0 : 1;
  }
  return valueState(s, horizon);
}

function keyOf(s: Packed, horizon: number): string {
  const pack = (c: number[]) =>
    c[0]! | (c[1]! << 2) | (c[2]! << 4) | (c[3]! << 6) | (c[4]! << 8) | (c[5]! << 9);
  return `${pack(s.my)}|${pack(s.opp)}|${s.myLast}${s.oppLast}|${s.mySt},${s.oppSt},${s.myMax},${s.oppMax},${s.myW},${s.oppW}|${horizon}`;
}

function spendCost(idx: number, s: Packed): number {
  if (idx === I_COLOR) return 40;
  if (idx === I_CLUB || idx === I_DIAMOND) return 8;
  if (idx === I_BLACK) return s.mySt >= 2 ? 25 : 1;
  return 3;
}

function scoreMyCard(s: Packed, myI: number, horizon: number): number {
  const oppMoves = legal(s.opp, s.oppLast);
  if (oppMoves.length === 0) return 0.5;
  let mixAcc = 0;
  let mixW = 0;
  let worst = 1;
  for (const oppI of oppMoves) {
    const v = afterValue(applyMove(s, myI, oppI), horizon - 1);
    const w = s.opp[oppI]!;
    mixAcc += v * w;
    mixW += w;
    if (v < worst) worst = v;
  }
  const mix = mixW > 0 ? mixAcc / mixW : 0.5;
  if (worst >= 0.999) return 1;
  return MIX * mix + (1 - MIX) * worst;
}

function valueState(s: Packed, horizon: number): number {
  tick();
  if (_timedOut) return 0.5;
  const locked = lockValue(s);
  if (locked !== null) return locked;
  if (horizon <= 0) return leafEval(s);

  const k = keyOf(s, horizon);
  const hit = _memo.get(k);
  if (hit !== undefined) return hit;

  const mine = legal(s.my, s.myLast);
  if (mine.length === 0) {
    const v = 0.5;
    if (!_timedOut) _memo.set(k, v);
    return v;
  }

  let best = -1;
  for (const myI of mine) {
    if (_timedOut) break;
    const ev = scoreMyCard(s, myI, horizon);
    if (ev > best) best = ev;
  }
  if (best < 0) best = 0.5;
  if (!_timedOut) _memo.set(k, best);
  return best;
}

function pickAtHorizon(s: Packed, horizon: number): WsAdvisorPick {
  const mine = legal(s.my, s.myLast);
  const fallback: WsAdvisorPick = {
    card: CARD_TYPES[mine[0] ?? I_HEART]!,
    winRate: 0.5,
  };
  if (mine.length === 0) return fallback;

  let best = fallback;
  let bestEv = -Infinity;
  let bestCost = Infinity;
  for (const myI of mine) {
    if (_timedOut && bestEv > -Infinity) break;
    const ev = scoreMyCard(s, myI, horizon);
    const cost = spendCost(myI, s);
    if (ev > bestEv + 1e-6 || (Math.abs(ev - bestEv) <= 1e-6 && cost < bestCost)) {
      bestEv = ev;
      bestCost = cost;
      best = {
        card: CARD_TYPES[myI]!,
        winRate: Math.min(1, Math.max(0, ev)),
      };
    }
  }
  return best;
}

export function pickWinningStreakAdvisor(
  history: WsAdvisorRound[],
  timeLimitMs: number,
): WsAdvisorPick {
  _deadline = Date.now() + Math.max(50, timeLimitMs);
  _timedOut = false;
  _allowTimeout = false;
  _nodes = 0;
  _memo.clear();

  const snap = wsAdvisorSnapshot(history);
  if (snap.result.kind !== 'playing') {
    return { card: 'heart', winRate: snap.result.kind === 'win' ? 1 : snap.result.kind === 'loss' ? 0 : 0.5 };
  }

  const s = fromSnap(snap);
  const mine = legal(s.my, s.myLast);
  const fallback: WsAdvisorPick = {
    card: CARD_TYPES[mine[0] ?? I_HEART]!,
    winRate: wsAdvisorHopeless(snap, 'my') ? 0 : wsAdvisorHopeless(snap, 'opp') ? 1 : 0.5,
  };
  if (mine.length === 1) {
    return { card: CARD_TYPES[mine[0]!]!, winRate: fallback.winRate === 0.5 ? lockValue(s) ?? 0.5 : fallback.winRate };
  }

  const remaining = Math.max(1, s.left);
  const startH = remaining <= 6 ? remaining : Math.min(4, remaining);
  let chosen = fallback;
  let completed = 0;

  for (let h = startH; h <= remaining; h++) {
    if (h > startH && Date.now() >= _deadline) break;
    _timedOut = false;
    _allowTimeout = h > startH;
    _memo.clear();
    const pick = pickAtHorizon(s, h);
    if (h === startH || !_timedOut) {
      chosen = pick;
      completed = h;
    }
  }

  console.info(
    `[WS advisor] round=${snap.round} pick=${chosen.card} ev=${chosen.winRate.toFixed(3)} horizon=${completed}/${remaining} nodes=${_nodes}`,
  );
  return chosen;
}

export function parseAdvisorHistory(raw: unknown): WsAdvisorRound[] | null {
  if (!Array.isArray(raw) || raw.length > 10) return null;
  const seenMy: WSCardCount = {
    spade: 0, diamond: 0, heart: 0, club: 0, blackJoker: 0, colorJoker: 0,
  };
  const seenOpp: WSCardCount = { ...seenMy };
  const out: WsAdvisorRound[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const rec = row as Record<string, unknown>;
    if (!CARD_TYPES.includes(rec.myCard as WSCardType)) return null;
    if (!CARD_TYPES.includes(rec.oppCard as WSCardType)) return null;
    const myCard = rec.myCard as WSCardType;
    const oppCard = rec.oppCard as WSCardType;
    seenMy[myCard] += 1;
    seenOpp[oppCard] += 1;
    if (seenMy[myCard] > 2 && myCard !== 'blackJoker' && myCard !== 'colorJoker') return null;
    if (seenOpp[oppCard] > 2 && oppCard !== 'blackJoker' && oppCard !== 'colorJoker') return null;
    if (myCard === 'blackJoker' && seenMy.blackJoker > 1) return null;
    if (myCard === 'colorJoker' && seenMy.colorJoker > 1) return null;
    if (oppCard === 'blackJoker' && seenOpp.blackJoker > 1) return null;
    if (oppCard === 'colorJoker' && seenOpp.colorJoker > 1) return null;
    out.push({ myCard, oppCard });
  }
  return out;
}

export interface WsSuperWorkerRequest {
  history: WsAdvisorRound[];
  timeLimitMs?: number;
}

export interface WsSuperWorkerResponse extends WsAdvisorPick {}

export function __resetWsSuperSearchForTests(): void {
  _memo.clear();
  _timedOut = false;
  _allowTimeout = true;
  _nodes = 0;
}

/** 테스트: 이번 라운드만의 승률. 슈퍼 픽은 이걸 최대화하면 안 된다. */
export function wsRoundWinRate(card: WSCardType, opp: WSCardCount, oppLast: WSCardType | null): number {
  const bag = wsLegalCards(opp, oppLast);
  if (bag.length === 0) return 0.5;
  let win = 0;
  let tot = 0;
  for (const c of bag) {
    const n = opp[c];
    tot += n;
    const r = WS_MATCHUP[card][c];
    if (r === 'win' || r === 'draw_win') win += n;
  }
  return tot > 0 ? win / tot : 0.5;
}
