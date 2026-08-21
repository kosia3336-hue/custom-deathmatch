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

interface Plan {
  invest: IDCoinAllocation;
  donate: IDCoinAllocation;
  investTotal: number;
  donateTotal: number;
  score: number;
}

type Prefer = 'small' | 'large';

function emptyAlloc(): IDCoinAllocation {
  return { coin50: 0, coin10: 0, coin1: 0 };
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

/** 목표 금액을 권종으로 만들기. small=잔돈 우선(50 보존), large=큰 코인 우선 */
function makeAmount(target: number, stock: IDCoinStock, prefer: Prefer): IDCoinAllocation | null {
  if (target < 0) return null;
  if (target === 0) return emptyAlloc();
  if (target > stockTotal(stock)) return null;

  if (prefer === 'large') {
    let rem = target;
    const c50 = Math.min(Math.floor(rem / 50), stock.coin50);
    rem -= c50 * 50;
    const c10 = Math.min(Math.floor(rem / 10), stock.coin10);
    rem -= c10 * 10;
    const c1 = Math.min(rem, stock.coin1);
    rem -= c1;
    if (rem !== 0) return null;
    return { coin50: c50, coin10: c10, coin1: c1 };
  }

  // small: 1 → 10 → 50. 목표를 맞출 수 없으면 실패(그리디 실패 시 전수 소량 탐색)
  {
    let rem = target;
    const c1 = Math.min(rem, stock.coin1);
    rem -= c1;
    const c10 = Math.min(Math.floor(rem / 10), stock.coin10);
    rem -= c10 * 10;
    const c50 = Math.min(Math.floor(rem / 50), stock.coin50);
    rem -= c50 * 50;
    if (rem === 0) return { coin50: c50, coin10: c10, coin1: c1 };
  }

  // 잔돈만으로 안 되면 50을 최소로 쓰며 맞춤
  for (let c50 = 0; c50 <= stock.coin50; c50++) {
    const leftAfter50 = target - c50 * 50;
    if (leftAfter50 < 0) break;
    for (let c10 = 0; c10 <= stock.coin10; c10++) {
      const left = leftAfter50 - c10 * 10;
      if (left < 0) break;
      if (left <= stock.coin1) {
        return { coin50: c50, coin10: c10, coin1: left };
      }
    }
  }
  return null;
}

/** 투자·기부 두 금액을 동시에 권종으로 맞춘다 */
function makePair(
  investTarget: number,
  donateTarget: number,
  stock: IDCoinStock,
  prefer: Prefer,
): { invest: IDCoinAllocation; donate: IDCoinAllocation } | null {
  const invest = makeAmount(investTarget, stock, prefer);
  if (!invest) return null;
  const rem = subtractAlloc(stock, invest, emptyAlloc());
  const donate = makeAmount(donateTarget, rem, prefer);
  if (!donate) return null;
  if (!clampAlloc(stock, invest, donate)) return null;
  return { invest, donate };
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

function avg(xs: number[], fallback: number): number {
  if (xs.length === 0) return fallback;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 라운드당 soft spend 상한 — 초반 50 불사르기 방지 */
function softSpendCap(
  total: number,
  roundsLeft: number,
  scoreDiff: number,
  tier: DummyAiTier,
): number {
  const pace = total / Math.max(1, roundsLeft);
  let cap = pace * (tier === '하' ? 1.55 : tier === '중' ? 1.35 : 1.25);

  // 초·중반: 큰 권종을 쓸 여지가 생기는 금액 자체를 막음
  if (roundsLeft >= 6) cap = Math.min(cap, 28);
  else if (roundsLeft >= 5) cap = Math.min(cap, 34);
  else if (roundsLeft >= 4) cap = Math.min(cap, 42);
  else if (roundsLeft >= 3) cap = Math.min(cap, 55);

  if (scoreDiff <= -2) cap *= 1.2;
  else if (scoreDiff >= 2 && roundsLeft <= 3) cap *= 0.85;

  if (roundsLeft <= 1) return total;
  return Math.max(0, Math.floor(cap));
}

function roundScoreDelta(myI: number, myD: number, oppI: number, oppD: number): number {
  let d = 0;
  if (myI > oppI) d += 1;
  // 기부: 상대보다 많아야 페널티 회피. 같거나 적으면 -1
  if (myD <= oppD) d -= 1;
  return d;
}

/** 남은 권종 유연성: 만들 수 있는 금액 종류 + 50 보존 */
function residualValue(stock: IDCoinStock, roundsLeft: number): number {
  const distinct = (stock.coin50 + 1) * (stock.coin10 + 1) * (stock.coin1 + 1);
  // 조합 수는 작음(최대 3*7*11=231). 정규화
  let v = Math.min(1.2, distinct / 80);
  v += stock.coin50 * (roundsLeft >= 4 ? 0.55 : roundsLeft >= 2 ? 0.25 : 0.05);
  v += stock.coin10 * 0.04;
  v += Math.min(stock.coin1, 6) * 0.015;
  return v;
}

function fiftyPenalty(used50: number, roundsLeft: number, spend: number, softCap: number): number {
  if (used50 <= 0) return 0;
  // 초반에 50을 쓰려면 spend가 softCap 근처·이상이어야 할 때만 약하게 허용
  let p = 0;
  if (roundsLeft >= 5) p -= used50 * 2.2;
  else if (roundsLeft >= 4) p -= used50 * 1.4;
  else if (roundsLeft >= 3) p -= used50 * 0.7;
  else if (roundsLeft >= 2) p -= used50 * 0.25;
  if (spend > softCap + 15 && roundsLeft >= 4) p -= 0.8;
  return p;
}

/**
 * 상대 공개 스톡에서 합법 (I,D) 샘플.
 * 총액만 뽑지 않고, 실제로 권종으로 만들 수 있는 쌍만.
 */
function sampleOppPlay(
  view: InvestDonateDummyView,
  tier: DummyAiTier,
): { invest: number; donate: number } {
  const stock = view.opp.coinStock;
  const total = stockTotal(stock);
  const roundsLeft = view.totalRounds - view.round + 1;
  const scoreDiff = view.opp.score - view.my.score; // 상대 관점
  const cap = softSpendCap(total, roundsLeft, scoreDiff, tier);
  const { invests, donates } = historyTotals(view.roundHistory, view.oppId);
  const meanI = avg(invests, Math.min(18, Math.floor(cap * 0.55)));
  const meanD = avg(donates, Math.min(12, Math.floor(cap * 0.4)));

  const noise = tier === '하' ? 0.5 : tier === '중' ? 0.32 : 0.2;
  const roll = Math.random();

  // 가끔 올세이브 / 공격
  if (roll < 0.1) return { invest: 0, donate: 0 };
  if (roll < 0.14 && roundsLeft <= 2) {
    const pair = makePair(
      Math.min(total, Math.floor(total * 0.45)),
      Math.min(total, Math.floor(total * 0.35)),
      stock,
      'large',
    );
    if (pair) return { invest: coinValue(pair.invest), donate: coinValue(pair.donate) };
  }

  const targetI = Math.max(0, Math.round(meanI + (Math.random() * 2 - 1) * (meanI * noise + 4)));
  const targetD = Math.max(0, Math.round(meanD + (Math.random() * 2 - 1) * (meanD * noise + 3)));
  let spend = targetI + targetD;
  if (spend > cap) {
    const scale = cap / Math.max(1, spend);
    spend = Math.floor(cap);
    const i = Math.floor(targetI * scale);
    const d = Math.max(0, spend - i);
    const pair = makePair(i, d, stock, Math.random() < 0.65 ? 'small' : 'large');
    if (pair) return { invest: coinValue(pair.invest), donate: coinValue(pair.donate) };
  }

  // 권종 제약으로 목표 실패 시: 스톡에서 랜덤 소액 사용
  const prefer: Prefer = Math.random() < 0.7 ? 'small' : 'large';
  let pair = makePair(
    Math.min(targetI, total),
    Math.min(targetD, Math.max(0, total - Math.min(targetI, total))),
    stock,
    prefer,
  );
  if (pair) return { invest: coinValue(pair.invest), donate: coinValue(pair.donate) };

  // fallback: 잔돈만으로 작은 수
  const max1 = Math.min(stock.coin1, cap);
  const max10 = Math.min(stock.coin10, Math.floor(cap / 10));
  const c1 = Math.floor(Math.random() * (max1 + 1));
  const c10 = Math.floor(Math.random() * (max10 + 1));
  const spend2 = c1 + c10 * 10;
  const i2 = Math.floor(Math.random() * (spend2 + 1));
  pair = makePair(i2, spend2 - i2, stock, 'small');
  if (pair) return { invest: coinValue(pair.invest), donate: coinValue(pair.donate) };
  return { invest: 0, donate: 0 };
}

function pushPlan(
  plans: Plan[],
  seen: Set<string>,
  stock: IDCoinStock,
  i: number,
  d: number,
  prefer: Prefer,
): void {
  i = Math.max(0, Math.round(i));
  d = Math.max(0, Math.round(d));
  const pair = makePair(i, d, stock, prefer);
  if (!pair) return;
  const investTotal = coinValue(pair.invest);
  const donateTotal = coinValue(pair.donate);
  const key = `${investTotal}:${donateTotal}:${pair.invest.coin50}-${pair.invest.coin10}-${pair.invest.coin1}:${pair.donate.coin50}-${pair.donate.coin10}-${pair.donate.coin1}`;
  if (seen.has(key)) return;
  seen.add(key);
  plans.push({
    invest: pair.invest,
    donate: pair.donate,
    investTotal,
    donateTotal,
    score: 0,
  });
}

function buildCandidates(view: InvestDonateDummyView, tier: DummyAiTier): Plan[] {
  const stock = view.my.coinStock;
  const myTotal = stockTotal(stock);
  const roundsLeft = view.totalRounds - view.round + 1;
  const scoreDiff = view.my.score - view.opp.score;
  const softCap = softSpendCap(myTotal, roundsLeft, scoreDiff, tier);
  const hardCap = Math.min(myTotal, Math.floor(softCap * (tier === '하' ? 1.45 : 1.25)) + (roundsLeft <= 2 ? 20 : 0));

  const { invests: oppHistI, donates: oppHistD } = historyTotals(view.roundHistory, view.oppId);
  const oppMeanI = avg(oppHistI, Math.min(16, Math.floor(softSpendCap(stockTotal(view.opp.coinStock), roundsLeft, -scoreDiff, tier) * 0.55)));
  const oppMeanD = avg(oppHistD, Math.min(10, Math.floor(softSpendCap(stockTotal(view.opp.coinStock), roundsLeft, -scoreDiff, tier) * 0.4)));

  const plans: Plan[] = [];
  const seen = new Set<string>();
  const add = (i: number, d: number) => {
    if (i + d > hardCap && roundsLeft > 1) return;
    // 초반·중반은 small 우선, 막판은 large도
    pushPlan(plans, seen, stock, i, d, 'small');
    if (roundsLeft <= 3 || tier === '하') {
      pushPlan(plans, seen, stock, i, d, 'large');
    }
  };

  add(0, 0);

  // 페이싱 격자: softCap 안, 잔돈 단위 위주
  const step = softCap > 30 ? 2 : 1;
  for (let spend = 0; spend <= hardCap; spend += step) {
    // 투자/기부 분할 몇 개만 (전수 폭발 방지)
    const splits = new Set<number>();
    splits.add(0);
    splits.add(Math.floor(spend / 2));
    splits.add(Math.floor(spend * 0.6));
    splits.add(Math.floor(spend * 0.4));
    splits.add(spend);
    for (const i of splits) add(i, spend - i);
  }

  // 상대 평균 +1~+소수: 투자 우위 / 기부 페널티 회피의 핵심
  for (const di of [1, 2, 3, 5, 8]) {
    for (const dd of [1, 2, 3, 5, 8]) {
      add(Math.ceil(oppMeanI) + di, Math.ceil(oppMeanD) + dd);
    }
  }
  add(Math.ceil(oppMeanI) + 1, 0);
  add(0, Math.ceil(oppMeanD) + 1);
  add(Math.floor(oppMeanI * 0.5), Math.floor(oppMeanD * 0.5));

  // 점수 상황
  if (view.my.score <= 1) {
    add(1, Math.ceil(oppMeanD) + 5);
    add(Math.ceil(oppMeanI) + 1, Math.ceil(oppMeanD) + 8);
  }
  if (view.opp.score <= 1) {
    add(0, Math.ceil(oppMeanD) + 6);
    add(2, Math.ceil(oppMeanD) + 4);
  }
  if (scoreDiff > 0 && roundsLeft <= 2) {
    add(0, 0);
    add(1, 1);
    add(Math.ceil(oppMeanI) + 1, Math.ceil(oppMeanD) + 1);
  }
  if (scoreDiff < 0 && roundsLeft <= 2) {
    add(Math.floor(myTotal * 0.3), Math.floor(myTotal * 0.25));
    add(Math.ceil(oppMeanI) + 10, Math.ceil(oppMeanD) + 5);
  }

  // 상대 공개 스톡으로 "상대가 만들 수 있는 최대" 근처 견제
  const oppCap = softSpendCap(stockTotal(view.opp.coinStock), roundsLeft, -scoreDiff, tier);
  add(Math.min(hardCap, oppCap + 1), Math.min(hardCap, Math.floor(oppCap * 0.5) + 1));

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
  const same = (a: Plan, b: Plan) =>
    a.investTotal === b.investTotal
    && a.donateTotal === b.donateTotal
    && a.invest.coin50 === b.invest.coin50
    && a.donate.coin50 === b.donate.coin50;

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
 *
 * 핵심: 총액 EV만 보지 않는다.
 * - 권종(특히 50) 보존·페이싱 softCap
 * - 후보/상대 샘플 모두 실제 권종으로 만들 수 있는 쌍만
 * - 잔여 스톡 유연성을 점수에 포함
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
  const scoreDiff = view.my.score - view.opp.score;
  const softCap = softSpendCap(stockTotal(view.my.coinStock), roundsLeft, scoreDiff, tier);
  const resWeight = tier === '하' ? 0.45 : tier === '중' ? 0.85 : 1.15;

  await runPsychologySearch(budgetMs, () => {
    const opp = sampleOppPlay(view, tier);
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]!;
      let s = roundScoreDelta(p.investTotal, p.donateTotal, opp.invest, opp.donate);

      const used50 = p.invest.coin50 + p.donate.coin50;
      const spend = p.investTotal + p.donateTotal;
      s += fiftyPenalty(used50, roundsLeft, spend, softCap);

      const left = subtractAlloc(view.my.coinStock, p.invest, p.donate);
      s += residualValue(left, Math.max(0, roundsLeft - 1)) * resWeight;

      // softCap 초과 지출 감점 (막판 제외)
      if (roundsLeft > 1 && spend > softCap) {
        s -= ((spend - softCap) / 20) * (tier === '하' ? 0.35 : 0.7);
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

/** @deprecated 테스트/구버전용. 큰 코인 우선 — 더미 AI는 makePair(prefer small) 사용 */
export function allocateToCoinDenominations(
  targetInvest: number,
  targetDonate: number,
  stock: IDCoinStock,
): { invest: IDCoinAllocation; donate: IDCoinAllocation } {
  const pair = makePair(targetInvest, targetDonate, cloneStock(stock), 'large');
  if (pair) return pair;
  const invest = makeAmount(targetInvest, stock, 'large') ?? emptyAlloc();
  const rem = subtractAlloc(stock, invest, emptyAlloc());
  const donate = makeAmount(targetDonate, rem, 'large') ?? emptyAlloc();
  return { invest, donate };
}
