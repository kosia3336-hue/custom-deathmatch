import type { MBNWTile, MBNWTileColor, MbnwAdvisorRound } from '@shared/types/multiple-bnw.js';
import {
  MBNW_FLOW_ROWS,
  MBNW_OPEN_ROWS,
  MBNW_REPLY_ROWS,
  MBNW_RESPOND_ROWS,
  MBNW_SUSPECT_ROWS,
} from './kifu-prior-data.js';

const LAPLACE = 1;

function colorCode(c: MBNWTileColor): 0 | 1 {
  return c === 'white' ? 0 : 1;
}

const openByTile = new Map<number, number>();
const respond = new Map<string, number>();
const suspect = new Map<string, number>();
const suspectCtx = new Map<string, number>();
const reply = new Map<string, number>();
const replyCtx = new Map<number, number>();
const flow = new Map<string, number>();
const flowCtx = new Map<string, number>();

for (const [tile, n] of MBNW_OPEN_ROWS) openByTile.set(tile, n);
for (const [color, tile, n] of MBNW_RESPOND_ROWS) respond.set(`${color}:${tile}`, n);
for (const [tile, color, sus, n] of MBNW_SUSPECT_ROWS) {
  suspect.set(`${tile}:${color}:${sus}`, n);
  const k = `${tile}:${color}`;
  suspectCtx.set(k, (suspectCtx.get(k) ?? 0) + n);
}
for (const [my, opp, n] of MBNW_REPLY_ROWS) {
  reply.set(`${my}:${opp}`, n);
  replyCtx.set(my, (replyCtx.get(my) ?? 0) + n);
}
for (const [my, color, sus, next, nf, n] of MBNW_FLOW_ROWS) {
  flow.set(`${my}:${color}:${sus}:${next}:${nf}`, n);
  const ctx = `${my}:${color}:${sus}:${nf}`;
  flowCtx.set(ctx, (flowCtx.get(ctx) ?? 0) + n);
}

export function openWeight(tile: MBNWTile): number {
  return LAPLACE + (openByTile.get(tile) ?? 0) * 4;
}

export function respondWeight(oppColor: MBNWTileColor, tile: MBNWTile): number {
  return LAPLACE + (respond.get(`${colorCode(oppColor)}:${tile}`) ?? 0) * 4;
}

export function suspectYesWeight(tile: MBNWTile, oppColor: MBNWTileColor): number {
  const c = colorCode(oppColor);
  const yes = suspect.get(`${tile}:${c}:1`) ?? 0;
  const ctx = suspectCtx.get(`${tile}:${c}`) ?? 0;
  if (ctx >= 4) return LAPLACE + yes * 4;
  return LAPLACE + yes * 4;
}

export function suspectNoWeight(tile: MBNWTile, oppColor: MBNWTileColor): number {
  const c = colorCode(oppColor);
  const no = suspect.get(`${tile}:${c}:0`) ?? 0;
  return LAPLACE + no * 4;
}

export function replyWeight(myTile: MBNWTile, oppTile: MBNWTile): number {
  const exact = reply.get(`${myTile}:${oppTile}`) ?? 0;
  const ctx = replyCtx.get(myTile) ?? 0;
  if (ctx >= 4) return LAPLACE + exact * 4;
  return LAPLACE + exact * 4;
}

export function flowNextCount(
  history: MbnwAdvisorRound[],
  nextTile: MBNWTile,
  nextFirst: boolean,
): number {
  if (history.length === 0) return openByTile.get(nextTile) ?? 0;
  const last = history[history.length - 1]!;
  const c = colorCode(last.oppColor);
  const sus = last.mySuspected ? 1 : 0;
  const nf = nextFirst ? 1 : 0;
  const exact = flow.get(`${last.myTile}:${c}:${sus}:${nextTile}:${nf}`) ?? 0;
  const ctx = flowCtx.get(`${last.myTile}:${c}:${sus}:${nf}`) ?? 0;
  if (ctx >= 2) return exact;
  return exact;
}

export function flowPolicyBonus(
  history: MbnwAdvisorRound[],
  nextTile: MBNWTile,
  nextFirst: boolean,
): number {
  return 0.012 * Math.log(1 + flowNextCount(history, nextTile, nextFirst));
}
