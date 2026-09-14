import type { Nf4AdvisorRound } from '@shared/types/number4.js';
import { NF4_FLOW_ROWS, NF4_OPEN_ROWS, NF4_REPLY_ROWS } from './kifu-prior-data.js';

const LAPLACE = 1;

const openCount = new Map<string, number>();
const replyExact = new Map<string, number>();
const replyCtx = new Map<string, number>();
const replyByMyN = new Map<string, number>();
const flowExact = new Map<string, number>();
const flowCtx = new Map<string, number>();
const flowNoTile = new Map<string, number>();
const flowNoTileCtx = new Map<string, number>();

for (const [white, number, n] of NF4_OPEN_ROWS) {
  openCount.set(`${white}:${number}`, n);
}

for (const [myW, myN, opN, opW, n] of NF4_REPLY_ROWS) {
  replyExact.set(`${myW}:${myN}:${opW}:${opN}`, n);
  replyCtx.set(`${myW}:${myN}`, (replyCtx.get(`${myW}:${myN}`) ?? 0) + n);
  replyByMyN.set(`${myN}:${opW}:${opN}`, (replyByMyN.get(`${myN}:${opW}:${opN}`) ?? 0) + n);
}

for (const [pmw, pmn, pon, pok, ook, nw, nn, n] of NF4_FLOW_ROWS) {
  const exactKey = `${pmw}:${pmn}:${pon}:${pok}:${ook}:${nw}:${nn}`;
  const ctxKey = `${pmw}:${pmn}:${pon}:${pok}:${ook}`;
  const thinKey = `${pmn}:${pon}:${pok}:${ook}:${nw}:${nn}`;
  const thinCtx = `${pmn}:${pon}:${pok}:${ook}`;
  flowExact.set(exactKey, n);
  flowCtx.set(ctxKey, (flowCtx.get(ctxKey) ?? 0) + n);
  flowNoTile.set(thinKey, (flowNoTile.get(thinKey) ?? 0) + n);
  flowNoTileCtx.set(thinCtx, (flowNoTileCtx.get(thinCtx) ?? 0) + n);
}

function boolBit(v: boolean): 0 | 1 {
  return v ? 1 : 0;
}

/** 승자가 이 백·넘버를 낼 때, 상대가 (백, 넘버)를 낸 횟수 + 라플라스. */
export function replyWeight(myWhite: number, myNumber: number, opWhite: number, opNumber: number): number {
  const exact = replyExact.get(`${myWhite}:${myNumber}:${opWhite}:${opNumber}`) ?? 0;
  const ctx = replyCtx.get(`${myWhite}:${myNumber}`) ?? 0;
  if (ctx >= 4) return LAPLACE + exact * 4;
  const back = replyByMyN.get(`${myNumber}:${opWhite}:${opNumber}`) ?? 0;
  return LAPLACE + exact * 4 + back;
}

/** 이 수에 대해 기보에 나온 상대 응답이 있는지. 카운터 집합용. */
export function replySeen(myWhite: number, myNumber: number, opWhite: number, opNumber: number): boolean {
  return (replyExact.get(`${myWhite}:${myNumber}:${opWhite}:${opNumber}`) ?? 0) >= 2;
}

export function openingCount(white: number, number: number): number {
  return openCount.get(`${white}:${number}`) ?? 0;
}

/** 직전 공개 흐름에서 승자가 이 다음 수를 낸 횟수. 키 없으면 backoff. */
export function flowNextCount(history: Nf4AdvisorRound[], white: number, number: number): number {
  if (history.length === 0) return openingCount(white, number);

  const last = history[history.length - 1]!;
  const pmn = last.myNumber;
  const pon = last.oppNumber;
  const pok = boolBit(last.mySuccess);
  const ook = boolBit(last.oppSuccess);

  if (typeof last.myWhite === 'number') {
    const ctx = flowCtx.get(`${last.myWhite}:${pmn}:${pon}:${pok}:${ook}`) ?? 0;
    const exact = flowExact.get(`${last.myWhite}:${pmn}:${pon}:${pok}:${ook}:${white}:${number}`) ?? 0;
    if (ctx >= 2) return exact;
  }

  const thin = flowNoTile.get(`${pmn}:${pon}:${pok}:${ook}:${white}:${number}`) ?? 0;
  const thinCtx = flowNoTileCtx.get(`${pmn}:${pon}:${pok}:${ook}`) ?? 0;
  if (thinCtx >= 2) return thin;
  return openingCount(white, number);
}

/** 승률 스케일(0~1)에 더하는 흐름 선행. */
export function flowPolicyBonus(history: Nf4AdvisorRound[], white: number, number: number): number {
  const c = flowNextCount(history, white, number);
  return 0.09 * Math.log(1 + c);
}

/** 테스트·하위 호환: 오프닝 빈도를 라운드 1 접전처럼 보이게. */
export function kifuWeight(
  round: number,
  _myScore: number,
  _opScore: number,
  white: number,
  number: number,
): number {
  if (round === 1) return LAPLACE + openingCount(white, number);
  return LAPLACE + flowNextCount([], white, number);
}

export function scoreBucket(myScore: number, opScore: number): 0 | 1 | 2 {
  const diff = myScore - opScore;
  if (diff <= -2) return 0;
  if (diff >= 2) return 2;
  return 1;
}
