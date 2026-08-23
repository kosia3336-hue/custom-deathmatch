import type { DummyAiTier } from '@shared/dummy.js';
import type {
  IDCoinAllocation,
  IDCoinStock,
  IDPhase,
  IDRoundRecord,
  InvestDonateAction,
} from '@shared/types/invest-donate.js';
import { coinValue, stockTotal } from '@shared/types/invest-donate.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-005 · multi · 전적 집계 264판 / 3504 player-round.
 * 판정은 금액이지만 사람은 권종 스테퍼로 칸을 채운다. 한곳에 1원 3장(3원·13원)은 거의 없음.
 */

export interface InvestDonateDummyView {
  gameOver: boolean;
  phase: IDPhase;
  round: number;
  totalRounds: number;
  myId: string;
  oppId: string;
  my: {
    score: number;
    coinStock: IDCoinStock;
    submitted: boolean;
  };
  /** 상대 남은 코인은 UI에 공개 */
  opp: {
    score: number;
    coinStock: IDCoinStock;
    submitted: boolean;
  };
  /** 지난 라운드 투자/기부 총액·배지 (공개). 이번 라운드 제출은 없음 */
  roundHistory: IDRoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

export interface Plan {
  invest: IDCoinAllocation;
  donate: IDCoinAllocation;
  investTotal: number;
  donateTotal: number;
  score: number;
}

/** 기보 투자 칸 장수. key = `50-10-1` */
const GIBO_INV: Record<string, number> = {
  '0-0-1': 760,
  '0-0-0': 636,
  '0-1-0': 546,
  '0-1-1': 485,
  '1-0-0': 450,
  '0-0-2': 250,
  '0-1-2': 203,
  '1-0-1': 69,
  '0-2-0': 33,
  '1-1-0': 20,
  '1-0-2': 8,
  '0-2-1': 6,
  '0-2-2': 5,
  '1-1-1': 5,
};

/** 기보 기부 칸 */
const GIBO_DON: Record<string, number> = {
  '0-0-1': 780,
  '0-0-0': 606,
  '0-1-0': 559,
  '0-1-1': 553,
  '1-0-0': 333,
  '0-0-2': 283,
  '0-1-2': 236,
  '0-2-0': 44,
  '1-0-1': 42,
  '1-1-0': 11,
  '1-1-1': 7,
  '0-2-1': 6,
  '1-0-2': 4,
  '0-2-2': 2,
};

const GIBO_PRIOR = 0.08;

function emptyAlloc(): IDCoinAllocation {
  return { coin50: 0, coin10: 0, coin1: 0 };
}

export function pileKey(a: IDCoinAllocation): string {
  return `${a.coin50}-${a.coin10}-${a.coin1}`;
}

export function coinCount(a: IDCoinAllocation): number {
  return a.coin50 + a.coin10 + a.coin1;
}

function stockCount(s: IDCoinStock): number {
  return s.coin50 + s.coin10 + s.coin1;
}

function cloneStock(s: IDCoinStock): IDCoinStock {
  return { coin50: s.coin50, coin10: s.coin10, coin1: s.coin1 };
}

function clampAlloc(stock: IDCoinStock, invest: IDCoinAllocation, donate: IDCoinAllocation): boolean {
  return (
    invest.coin50 + donate.coin50 <= stock.coin50
    && invest.coin10 + donate.coin10 <= stock.coin10
    && invest.coin1 + donate.coin1 <= stock.coin1
    && invest.coin50 >= 0 && invest.coin10 >= 0 && invest.coin1 >= 0
    && donate.coin50 >= 0 && donate.coin10 >= 0 && donate.coin1 >= 0
  );
}

function subtractAlloc(stock: IDCoinStock, a: IDCoinAllocation, b: IDCoinAllocation): IDCoinStock {
  return {
    coin50: stock.coin50 - a.coin50 - b.coin50,
    coin10: stock.coin10 - a.coin10 - b.coin10,
    coin1: stock.coin1 - a.coin1 - b.coin1,
  };
}

/**
 * 한 칸 1원 상한. 기보에서 3장 이상은 0.7%.
 * 마지막 라운드에 1원만 남았을 때만 잔여 전부 허용.
 */
export function maxOnesPerPile(stock: IDCoinStock, roundsLeft: number): number {
  if (roundsLeft <= 1 && stock.coin10 === 0 && stock.coin50 === 0) {
    return stock.coin1;
  }
  return Math.min(2, stock.coin1);
}

function maxTensPerPile(stock: IDCoinStock, roundsLeft: number): number {
  if (roundsLeft <= 2) return Math.min(2, stock.coin10);
  return Math.min(1, stock.coin10);
}

/** 사람 칸: 50은 0~1, 10은 초반 0~1(막판 0~2), 1원은 0~2. 50+10은 중반 이후만. */
export function humanPiles(stock: IDCoinStock, roundsLeft: number): IDCoinAllocation[] {
  const piles: IDCoinAllocation[] = [];
  const max50 = Math.min(1, stock.coin50);
  const max10 = maxTensPerPile(stock, roundsLeft);
  const max1 = maxOnesPerPile(stock, roundsLeft);
  for (let c50 = 0; c50 <= max50; c50++) {
    for (let c10 = 0; c10 <= max10; c10++) {
      if (c50 === 1 && c10 >= 1 && roundsLeft > 3) continue;
      if (c50 === 1 && c10 >= 2) continue;
      // 50 위에 1원 2장(52)은 기보에 거의 없음. 51(+1)만.
      const onesCap = c50 === 1 && roundsLeft > 2 ? Math.min(1, max1) : max1;
      for (let c1 = 0; c1 <= onesCap; c1++) {
        piles.push({ coin50: c50, coin10: c10, coin1: c1 });
      }
    }
  }
  if (piles.length === 0) piles.push(emptyAlloc());
  return piles;
}

export function isHumanPile(a: IDCoinAllocation, stock: IDCoinStock, roundsLeft: number): boolean {
  if (a.coin50 < 0 || a.coin10 < 0 || a.coin1 < 0) return false;
  if (a.coin50 > 1 || a.coin50 > stock.coin50) return false;
  if (a.coin10 > maxTensPerPile(stock, roundsLeft)) return false;
  if (a.coin1 > maxOnesPerPile(stock, roundsLeft)) return false;
  if (a.coin50 === 1 && a.coin10 >= 1 && roundsLeft > 3) return false;
  if (a.coin50 === 1 && a.coin10 >= 2) return false;
  if (a.coin50 === 1 && a.coin1 >= 2 && roundsLeft > 2) return false;
  return true;
}

/** 기보: 라운드당 2~4장이 78%. 50 없이 작은 칸 싸움만 5~6장. */
export function fitsRoundBudget(
  invest: IDCoinAllocation,
  donate: IDCoinAllocation,
  roundsLeft: number,
): boolean {
  const n = coinCount(invest) + coinCount(donate);
  if (roundsLeft <= 1) return true;
  if (n <= 4) return true;
  const no50 = invest.coin50 === 0 && donate.coin50 === 0;
  if (n <= 6 && no50 && roundsLeft <= 4) return true;
  if (n <= 5 && roundsLeft <= 3) return true;
  return false;
}

function giboWeight(table: Record<string, number>, pile: IDCoinAllocation): number {
  const w = table[pileKey(pile)];
  if (w != null && w > 0) return w;
  if (coinCount(pile) === 0) return 1;
  return 1;
}

function weightedPick<T>(items: readonly T[], weight: (t: T) => number): T {
  let sum = 0;
  const ws = items.map(weight);
  for (const w of ws) sum += Math.max(0, w);
  if (sum <= 0) return items[Math.floor(Math.random() * items.length)]!;
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, ws[i]!);
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function snapToHumanPile(
  target: number,
  stock: IDCoinStock,
  roundsLeft: number,
): IDCoinAllocation {
  const piles = humanPiles(stock, roundsLeft).filter((p) =>
    p.coin50 <= stock.coin50 && p.coin10 <= stock.coin10 && p.coin1 <= stock.coin1,
  );
  if (piles.length === 0) return emptyAlloc();
  let best = piles[0]!;
  let bestScore = Infinity;
  for (const p of piles) {
    const diff = Math.abs(coinValue(p) - target);
    const s = diff * 100 + p.coin1 * 3 + coinCount(p);
    if (s < bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

function lastOppTotals(
  history: IDRoundRecord[],
  oppId: string,
): { invest: number; donate: number } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const p = history[i]!.players[oppId];
    if (p) return { invest: p.investTotal, donate: p.donateTotal };
  }
  return null;
}

function roundScoreDelta(myI: number, myD: number, oppI: number, oppD: number): number {
  let d = 0;
  if (myI > oppI) d += 1;
  if (myD <= oppD) d -= 1;
  return d;
}

function residualValue(stock: IDCoinStock, roundsLeft: number): number {
  if (roundsLeft <= 0) return stockTotal(stock) * 0.002;
  let v = 0;
  v += stock.coin50 * (roundsLeft >= 4 ? 0.5 : roundsLeft >= 2 ? 0.22 : 0.06);
  v += stock.coin10 * 0.07;
  // 1원은 오버슛 연료. 3장 몰아 쓰지 말고 남겨 둔 값이 큼
  v += Math.min(stock.coin1, 4) * 0.09 * (roundsLeft >= 3 ? 1 : 0.35);
  const coins = stockCount(stock);
  const pace = coins / roundsLeft;
  if (pace < 1.3) v -= (1.3 - pace) * 0.7;
  return v;
}

function historyTotals(history: IDRoundRecord[], pid: string): { invests: number[]; donates: number[] } {
  const invests: number[] = [];
  const donates: number[] = [];
  for (const r of history) {
    const p = r.players[pid];
    if (!p) continue;
    invests.push(p.investTotal);
    donates.push(p.donateTotal);
  }
  return { invests, donates };
}

/**
 * 상대 공개 스톡에서 사람 칸 모양 (I,D) 샘플.
 */
function sampleOppPlay(
  view: InvestDonateDummyView,
  tier: DummyAiTier,
): { invest: number; donate: number } {
  const stock = view.opp.coinStock;
  const roundsLeft = view.totalRounds - view.round + 1;
  const invPiles = humanPiles(stock, roundsLeft);
  const last = lastOppTotals(view.roundHistory, view.oppId);
  const sticky = last && (tier === '하' ? 0.18 : tier === '중' ? 0.32 : 0.42);

  if (last && sticky && Math.random() < sticky) {
    const invest = snapToHumanPile(last.invest, stock, roundsLeft);
    const rem = subtractAlloc(stock, invest, emptyAlloc());
    const donate = snapToHumanPile(last.donate, rem, roundsLeft);
    return { invest: coinValue(invest), donate: coinValue(donate) };
  }

  const invest = weightedPick(invPiles, (p) => {
    let w = giboWeight(GIBO_INV, p);
    if (tier === '하') w = w * 0.55 + 40;
    return w;
  });
  const rem = subtractAlloc(stock, invest, emptyAlloc());
  const donPiles = humanPiles(rem, roundsLeft).filter((p) =>
    p.coin50 <= rem.coin50 && p.coin10 <= rem.coin10 && p.coin1 <= rem.coin1,
  );
  const donate = weightedPick(donPiles, (p) => {
    let w = giboWeight(GIBO_DON, p);
    if (invest.coin50 > 0 && p.coin50 > 0) w *= 0.15;
    if (tier === '하') w = w * 0.55 + 40;
    return w;
  });
  return { invest: coinValue(invest), donate: coinValue(donate) };
}

function pushPlan(
  plans: Plan[],
  seen: Set<string>,
  stock: IDCoinStock,
  invest: IDCoinAllocation,
  donate: IDCoinAllocation,
  roundsLeft: number,
): void {
  if (!clampAlloc(stock, invest, donate)) return;
  if (!fitsRoundBudget(invest, donate, roundsLeft)) return;
  const investTotal = coinValue(invest);
  const donateTotal = coinValue(donate);
  const key = `${pileKey(invest)}:${pileKey(donate)}`;
  if (seen.has(key)) return;
  seen.add(key);
  plans.push({ invest, donate, investTotal, donateTotal, score: 0 });
}

export function buildCandidates(view: InvestDonateDummyView, _tier: DummyAiTier): Plan[] {
  const stock = view.my.coinStock;
  const roundsLeft = view.totalRounds - view.round + 1;
  const invPiles = humanPiles(stock, roundsLeft);
  const plans: Plan[] = [];
  const seen = new Set<string>();

  for (const invest of invPiles) {
    const rem = subtractAlloc(stock, invest, emptyAlloc());
    const donPiles = humanPiles(rem, roundsLeft);
    for (const donate of donPiles) {
      if (donate.coin50 > rem.coin50 || donate.coin10 > rem.coin10 || donate.coin1 > rem.coin1) continue;
      pushPlan(plans, seen, stock, invest, donate, roundsLeft);
    }
  }

  // 상대 직전 금액의 사람 모양 오버슛 (+1/+2, 같은 권종+1원)
  const last = lastOppTotals(view.roundHistory, view.oppId);
  if (last) {
    for (const [ti, td] of [
      [last.invest + 1, last.donate + 1],
      [last.invest + 1, last.donate + 2],
      [last.invest + 2, last.donate + 1],
      [last.invest, last.donate + 1],
      [last.invest + 1, last.donate],
      [0, last.donate + 1],
      [last.invest + 1, 0],
    ] as const) {
      const invest = snapToHumanPile(ti, stock, roundsLeft);
      const rem = subtractAlloc(stock, invest, emptyAlloc());
      const donate = snapToHumanPile(td, rem, roundsLeft);
      pushPlan(plans, seen, stock, invest, donate, roundsLeft);
    }
  }

  if (plans.length === 0) {
    plans.push({
      invest: emptyAlloc(),
      donate: emptyAlloc(),
      investTotal: 0,
      donateTotal: 0,
      score: 0,
    });
  }
  return plans;
}

function applyTierNoise(best: Plan, pool: Plan[], tier: DummyAiTier): Plan {
  if (pool.length <= 1) return best;
  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const r = Math.random();
  const same = (a: Plan, b: Plan) => pileKey(a.invest) === pileKey(b.invest) && pileKey(a.donate) === pileKey(b.donate);

  if (tier === '하') {
    if (r < 0.4) {
      const band = sorted.filter((p) => p.score >= best.score - 0.85).slice(0, 6);
      const alts = band.filter((p) => !same(p, best));
      return alts.length > 0 ? alts[Math.floor(Math.random() * alts.length)]! : best;
    }
    return best;
  }
  if (tier === '중') {
    if (r < 0.18) {
      const band = sorted.filter((p) => p.score >= best.score - 0.45).slice(0, 4);
      const alts = band.filter((p) => !same(p, best));
      return alts.length > 0 ? alts[Math.floor(Math.random() * alts.length)]! : best;
    }
    return best;
  }
  if (r < 0.05) {
    const second = sorted.find((p) => !same(p, best));
    return second && second.score >= best.score - 0.28 ? second : best;
  }
  return best;
}

/**
 * 공개: 내/상대 코인·점수·과거 총액. 이번 라운드 상대 배분 금지.
 * 후보는 사람 칸 모양만. 한곳에 1원 3장으로 3원·13원을 만들지 않는다.
 */
export async function pickInvestDonateActionAsync(
  view: InvestDonateDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<InvestDonateAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.phase !== 'submit') return null;
  if (view.myId !== dummyId) return null;
  if (view.my.submitted) return null;

  const plans = buildCandidates(view, tier);
  const acc = plans.map(() => 0);
  const roundsLeft = view.totalRounds - view.round + 1;
  const resWeight = tier === '하' ? 0.45 : tier === '중' ? 0.85 : 1.15;
  const last = lastOppTotals(view.roundHistory, view.oppId);
  const { invests: oppHistI } = historyTotals(view.roundHistory, view.oppId);

  await runPsychologySearch(budgetMs, () => {
    const opp = sampleOppPlay(view, tier);
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]!;
      let s = roundScoreDelta(p.investTotal, p.donateTotal, opp.invest, opp.donate);

      const left = subtractAlloc(view.my.coinStock, p.invest, p.donate);
      s += residualValue(left, Math.max(0, roundsLeft - 1)) * resWeight;

      const used50 = p.invest.coin50 + p.donate.coin50;
      if (used50 >= 1 && view.opp.coinStock.coin50 === 0 && roundsLeft >= 3) {
        s -= 0.85 * used50;
      }
      if (used50 >= 2) s -= 1.1;

      const ones = p.invest.coin1 + p.donate.coin1;
      if (p.invest.coin1 >= 3) s -= 3;
      if (p.donate.coin1 >= 3) s -= 3;
      if (ones >= 5 && roundsLeft > 1) s -= 0.7;

      const nCoins = coinCount(p.invest) + coinCount(p.donate);
      if (roundsLeft > 1 && nCoins >= 5) s -= 0.25 * (nCoins - 4);

      s += GIBO_PRIOR * Math.log(1 + giboWeight(GIBO_INV, p.invest));
      s += GIBO_PRIOR * Math.log(1 + giboWeight(GIBO_DON, p.donate));

      if (last) {
        if (p.investTotal === last.invest + 1) s += 0.22;
        if (p.donateTotal === last.donate + 1) s += 0.28;
        if (p.investTotal === last.invest + 2) s += 0.08;
        if (p.donateTotal === last.donate + 2) s += 0.1;
      }

      // 승점 1: 기부 동점도 -1 → 탈락. 기부를 사람 모양으로 한 칸 더.
      if (view.my.score <= 1) {
        if (p.donateTotal > opp.donate) s += 0.9;
        else s -= 1.4;
      }

      if (oppHistI.length === 0 && p.invest.coin1 >= 2 && p.invest.coin10 === 0 && p.invest.coin50 === 0) {
        s -= 0.15;
      }

      acc[i]! += s;
    }
  });

  for (let i = 0; i < plans.length; i++) {
    plans[i]!.score = acc[i]!;
  }

  const best = plans.reduce((a, b) => (b.score > a.score ? b : a));
  const chosen = applyTierNoise(best, plans, tier);

  if (!clampAlloc(view.my.coinStock, chosen.invest, chosen.donate)) {
    return { type: 'submit', invest: emptyAlloc(), donate: emptyAlloc() };
  }

  return { type: 'submit', invest: chosen.invest, donate: chosen.donate };
}

/** 목표 금액을 사람 칸 모양으로 스냅. 13→12, 3→2. 3원 몰아넣기 없음. */
export function allocateToCoinDenominations(
  targetInvest: number,
  targetDonate: number,
  stock: IDCoinStock,
): { invest: IDCoinAllocation; donate: IDCoinAllocation } {
  const s = cloneStock(stock);
  const invest = snapToHumanPile(targetInvest, s, 7);
  const rem = subtractAlloc(s, invest, emptyAlloc());
  const donate = snapToHumanPile(targetDonate, rem, 7);
  return { invest, donate };
}
