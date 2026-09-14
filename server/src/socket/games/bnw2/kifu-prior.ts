import type { BNW2Color } from '@shared/types/bnw2.js';
import {
  BNW2_FIRST_LEAK_ROWS,
  BNW2_FIRST_OPEN_ROWS,
  BNW2_SECOND_ROWS,
} from './kifu-prior-data.js';

const LAPLACE = 1;

const secondExact = new Map<string, number>();
const secondCtx = new Map<string, number>();
const openCount = new Map<number, number>();
let openTotal = 0;
const leakCount = new Map<string, number>();

for (const [color, drops, bid, n] of BNW2_SECOND_ROWS) {
  const k = `${color}:${drops}:${bid}`;
  const ctx = `${color}:${drops}`;
  secondExact.set(k, (secondExact.get(k) ?? 0) + n);
  secondCtx.set(ctx, (secondCtx.get(ctx) ?? 0) + n);
}
for (const [bid, n] of BNW2_FIRST_OPEN_ROWS) {
  openCount.set(bid, (openCount.get(bid) ?? 0) + n);
  openTotal += n;
}
for (const [phase, color, drops, n] of BNW2_FIRST_LEAK_ROWS) {
  leakCount.set(`${phase}:${color}:${drops}`, n);
}

export function colorBit(c: BNW2Color): 0 | 1 {
  return c === 'white' ? 1 : 0;
}

export function kifuPhase(myScore: number, oppScore: number): 0 | 1 | 2 {
  const s = myScore + oppScore;
  if (s <= 2) return 0;
  if (myScore >= 8 || oppScore >= 8) return 2;
  return 1;
}

export function kifuDrops(stageBefore: number, stageAfter: number): number {
  return Math.max(0, stageBefore - stageAfter);
}

/** 이 색·불에서 후가 그 제시를 낸 횟수 + 라플라스. 기보에 없으면 맥락만. */
export function kifuSecondWeight(color: BNW2Color, drops: number, bid: number): number {
  const c = colorBit(color);
  const d = Math.min(6, Math.max(0, drops));
  const exact = secondExact.get(`${c}:${d}:${bid}`) ?? 0;
  const ctx = secondCtx.get(`${c}:${d}`) ?? 0;
  if (ctx >= 8) return LAPLACE + exact * 4;
  const near = secondExact.get(`${c}:${Math.max(0, d - 1)}:${bid}`) ?? 0;
  return LAPLACE + exact * 4 + near;
}

export function kifuOpenWeight(bid: number): number {
  return LAPLACE + (openCount.get(bid) ?? 0) * 4;
}

export function kifuOpenShare(bid: number): number {
  const n = openCount.get(bid) ?? 0;
  return (LAPLACE + n) / (openTotal + 20 * LAPLACE);
}

export function kifuLeakWeight(phase: 0 | 1 | 2, color: BNW2Color, drops: number): number {
  const n = leakCount.get(`${phase}:${colorBit(color)}:${Math.min(6, drops)}`) ?? 0;
  return LAPLACE + n;
}

export function kifuFirstWeight(
  round: number,
  myScore: number,
  oppScore: number,
  color: BNW2Color,
  drops: number,
  bid: number,
): number {
  if (round <= 1) return kifuOpenWeight(bid);
  const leak = kifuLeakWeight(kifuPhase(myScore, oppScore), color, drops);
  const cheap = color === 'black' ? 1 / (1 + bid) : 1 / (1 + Math.max(0, bid - 10));
  return leak * (0.35 + cheap);
}

/** 선 누출을 기보 비율로 뽑는다. */
export function sampleKifuLeak(
  phase: 0 | 1 | 2,
  rng: () => number,
): { color: BNW2Color; drops: number } {
  const rows = BNW2_FIRST_LEAK_ROWS.filter((r) => r[0] === phase);
  let z = 0;
  for (const r of rows) z += r[3];
  if (z <= 0) return { color: 'white', drops: 1 };
  let t = rng() * z;
  for (const r of rows) {
    t -= r[3];
    if (t <= 0) return { color: r[1] === 1 ? 'white' : 'black', drops: r[2] };
  }
  const last = rows[rows.length - 1]!;
  return { color: last[1] === 1 ? 'white' : 'black', drops: last[2] };
}

export function sampleWeighted(items: Array<{ item: number; w: number }>, rng: () => number): number {
  let z = 0;
  for (const x of items) z += Math.max(0, x.w);
  if (z <= 0) return items[0]?.item ?? 0;
  let t = rng() * z;
  for (const x of items) {
    t -= Math.max(0, x.w);
    if (t <= 0) return x.item;
  }
  return items[items.length - 1]?.item ?? 0;
}
