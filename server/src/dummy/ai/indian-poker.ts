import type { DummyAiTier } from '@shared/dummy.js';
import type {
  IndianPokerAction,
  IPBettingAction,
  IPHand,
  IPPhase,
} from '@shared/types/indian-poker.js';
import { evaluateHand, judgeShowdown } from '../../socket/games/indian-poker/judge.js';
import { runPsychologySearch } from '../psychologySearch.js';

export interface IndianPokerDummyView {
  gameOver: boolean;
  phase: IPPhase;
  round: number;
  myId: string;
  oppId: string;
  communityCards: [number, number] | null;
  /** 상대 홀카드 (규칙상 공개). 내 카드는 절대 없음. */
  oppCard: number | null;
  /** 공개된 소모 카드만 — 내 홀카드 제외 */
  knownBurned: number[];
  my: { chips: number; roundBet: number };
  opp: { chips: number; roundBet: number };
  pot: number;
  currentBet: number;
  ante: number;
  currentTurnId: string | null;
  firstBettorId: string;
  bettingStarted: boolean;
  currentRoundActions: IPBettingAction[];
  oppRaiseRounds: number;
  oppDieRounds: number;
  historyRounds: number;
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

const HAND_RANK: Record<IPHand, number> = {
  noPair: 0,
  double: 1,
  straight: 2,
  triple: 3,
};

interface Rates {
  win: number;
  lose: number;
  draw: number;
  hand: Record<IPHand, number>;
}

interface WinAcc {
  win: number;
  lose: number;
  draw: number;
  noPair: number;
  double: number;
  straight: number;
  triple: number;
  n: number;
}

type ScoredAction = { action: IndianPokerAction; score: number; label: string };

function createFullDeckCounts(): Map<number, number> {
  const m = new Map<number, number>();
  for (let n = 1; n <= 10; n++) m.set(n, 4);
  return m;
}

export function possibleMyCards(knownBurned: number[]): number[] {
  const counts = createFullDeckCounts();
  for (const c of knownBurned) {
    counts.set(c, (counts.get(c) ?? 0) - 1);
  }
  const out: number[] = [];
  for (const [n, cnt] of counts) {
    for (let i = 0; i < Math.max(0, cnt); i++) out.push(n);
  }
  return out;
}

function sampleCard(pool: number[]): number {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function emptyAcc(): WinAcc {
  return { win: 0, lose: 0, draw: 0, noPair: 0, double: 0, straight: 0, triple: 0, n: 0 };
}

function observe(
  acc: WinAcc,
  myCard: number,
  oppCard: number,
  community: [number, number],
  myId: string,
  oppId: string,
): void {
  const myHand = evaluateHand(myCard, community);
  const oppHand = evaluateHand(oppCard, community);
  const result = judgeShowdown(
    { id: myId, card: myCard, hand: myHand },
    { id: oppId, card: oppCard, hand: oppHand },
  );
  acc.n += 1;
  acc[myHand] += 1;
  if (result.isDraw) acc.draw += 1;
  else if (result.winnerId === myId) acc.win += 1;
  else acc.lose += 1;
}

function readRates(acc: WinAcc, tier: DummyAiTier): Rates {
  const n = Math.max(1, acc.n);
  let win = acc.win / n;
  let lose = acc.lose / n;
  let draw = acc.draw / n;
  // 중·상은 MC를 거의 신뢰. 하만 얕게 섞음.
  if (tier === '하') {
    win = win * 0.7 + (1 / 3) * 0.3;
    lose = lose * 0.7 + (1 / 3) * 0.3;
    draw = Math.max(0, 1 - win - lose);
  }
  return {
    win,
    lose,
    draw,
    hand: {
      noPair: acc.noPair / n,
      double: acc.double / n,
      straight: acc.straight / n,
      triple: acc.triple / n,
    },
  };
}

function canCheck(view: IndianPokerDummyView): boolean {
  return !view.bettingStarted && view.currentTurnId === view.firstBettorId;
}

function callCostOf(view: IndianPokerDummyView): number {
  return Math.max(0, view.opp.roundBet - view.my.roundBet);
}

function maxRaiseTo(view: IndianPokerDummyView): number {
  return Math.min(view.my.roundBet + view.my.chips, view.opp.roundBet + view.opp.chips);
}

function minRaiseTo(view: IndianPokerDummyView): number {
  return view.opp.roundBet + 1;
}

function expectedDiePenalty(hand: Rates['hand'], chips: number): number {
  const raw = hand.double * 5 + (hand.straight + hand.triple) * 10;
  return Math.min(raw, chips);
}

/** 콜 EV: 콜 칩이 팟에 들어간 뒤 쇼다운 */
function callShowdownEV(rates: Rates, pot: number, cost: number): number {
  if (cost <= 0) {
    return rates.win * pot + rates.draw * (pot / 2);
  }
  const potAfter = pot + cost;
  return rates.win * potAfter + rates.draw * (potAfter / 2) - rates.lose * cost;
}

function oppAggressiveness(view: IndianPokerDummyView): number {
  if (view.historyRounds === 0) return 0.45;
  const t = view.historyRounds;
  const score = view.oppRaiseRounds / t - (view.oppDieRounds / t) * 0.45 + 0.45;
  return Math.min(1, Math.max(0, score));
}

/**
 * 의미 있는 레이즈 목표 roundBet.
 * +1만 남는 붕괴를 피하려고 팟 배수·스택 비율을 쓴다.
 */
function raiseTargets(view: IndianPokerDummyView, rates: Rates): number[] {
  const minA = minRaiseTo(view);
  const maxA = maxRaiseTo(view);
  if (minA > maxA) return [];

  const pot = Math.max(view.pot, view.ante * 2);
  const addFromMy = (add: number) => view.my.roundBet + add;

  // 승률에 따라 선호 사이즈 풀이 달라짐 (후보 자체)
  const fracs =
    rates.win >= 0.75 ? [0.75, 1.0, 1.5, 2.0]
      : rates.win >= 0.55 ? [0.5, 0.75, 1.0, 1.5]
        : rates.win >= 0.4 ? [0.4, 0.66, 1.0]
          : [0.33, 0.5, 0.75]; // 블러프/세미

  const raw: number[] = [minA];
  for (const f of fracs) {
    raw.push(addFromMy(Math.max(1, Math.ceil(pot * f))));
    raw.push(view.opp.roundBet + Math.max(1, Math.ceil(pot * f)));
  }
  // 스택 비율
  raw.push(addFromMy(Math.max(1, Math.ceil(view.my.chips * 0.35))));
  raw.push(addFromMy(Math.max(1, Math.ceil(view.my.chips * 0.6))));
  raw.push(maxA); // 잼

  const uniq = [...new Set(
    raw.map((a) => Math.min(maxA, Math.max(minA, a))).filter((a) => a >= minA && a <= maxA),
  )];
  return uniq.sort((a, b) => a - b);
}

/**
 * 상대가 우리 레이즈에 폴드할 대략 확률 (공개 족보·사이즈·승률).
 * 정확한 모델이 아니라 휴리스틱.
 */
function estimateFoldEquity(
  view: IndianPokerDummyView,
  oppHand: IPHand,
  raiseTo: number,
  rates: Rates,
  tier: DummyAiTier,
): number {
  const add = raiseTo - view.my.roundBet;
  const pot = Math.max(1, view.pot);
  const size = add / pot;
  const oppRank = HAND_RANK[oppHand];
  const agg = oppAggressiveness(view);

  let fe = 0.28;
  // 상대 공개 손이 강하면 폴드 거의 안 함
  if (oppRank >= 2) fe = 0.04; // 스트레이트+
  else if (oppRank === 1) fe = 0.08; // 더블
  else fe = 0.32 + (1 - agg) * 0.18; // 노페어

  // 큰 사이즈일수록 폴드↑ (노페어 상대에게만 의미)
  if (oppRank === 0) fe += Math.min(0.25, size * 0.15);
  else fe += Math.min(0.04, size * 0.02);

  // 우리가 약하면 블러프 FE를 깎음 (상대가 콜해도 이김을 앎)
  if (rates.win < 0.35) fe *= 0.55;
  if (rates.win > 0.65) fe *= 0.85; // 가치벳은 FE에 덜 의존

  if (tier === '하') fe *= 0.7;
  if (tier === '상') fe *= 1.05;

  return Math.min(0.55, Math.max(0.02, fe));
}

function raiseEV(
  view: IndianPokerDummyView,
  rates: Rates,
  raiseTo: number,
  oppHand: IPHand,
  tier: DummyAiTier,
): number {
  const add = raiseTo - view.my.roundBet;
  if (add <= 0) return -999;
  const pot = view.pot;
  const fe = estimateFoldEquity(view, oppHand, raiseTo, rates, tier);
  // 폴드 시 현재 팟 획득 (상대는 추가 안 냄)
  const foldPart = fe * pot;
  // 콜/계속 시: 상대가 콜한다고 가정하고 쇼다운 (보수적)
  const potIfCalled = pot + add + Math.min(add, view.opp.chips); // 대략 매칭
  const callPart =
    (1 - fe)
    * (rates.win * potIfCalled + rates.draw * (potIfCalled / 2) - rates.lose * add);
  return foldPart + callPart;
}

function buildScoredActions(
  view: IndianPokerDummyView,
  rates: Rates,
  oppHand: IPHand,
  tier: DummyAiTier,
): ScoredAction[] {
  const out: ScoredAction[] = [];
  const cost = callCostOf(view);
  const diePen = expectedDiePenalty(rates.hand, view.my.chips);
  const oppRank = HAND_RANK[oppHand];
  const potOdds = cost > 0 ? cost / (view.pot + cost) : 0;

  // ── DIE ──
  out.push({ action: { type: 'die' }, score: -diePen, label: 'die' });

  // ── CHECK / CALL ──
  if (canCheck(view)) {
    // 체크 = 무료로 판을 넘김. 앞서면 가치벳이 더 낫고, 뒤지면 체크가 안전.
    const checkScore =
      rates.win * view.pot * 0.25
      - rates.lose * 0.4
      + (rates.win < 0.4 ? 0.6 : 0)
      + (oppRank >= 1 && rates.win < 0.45 ? 1.2 : 0);
    out.push({ action: { type: 'check' }, score: checkScore, label: 'check' });
  } else if (cost <= view.my.chips) {
    let cEV = callShowdownEV(rates, view.pot, cost);
    // 팟 오즈: 필요 승률보다 여유가 있으면 가산
    if (rates.win + rates.draw * 0.5 > potOdds + 0.02) cEV += 0.8;
    else if (rates.win + rates.draw * 0.5 < potOdds - 0.08) cEV -= 1.5;
    // 공개 더블+에 약한 분포면 콜 큰 감점
    if (oppRank >= 1 && rates.win < 0.38) cEV -= 2.5 + (1 - rates.win) * 2;
    if (oppRank >= 2 && rates.win < 0.5) cEV -= 3;
    out.push({ action: { type: 'call' }, score: cEV, label: 'call' });
  }

  // ── RAISE ──
  const crushed = oppRank >= 1 && rates.win < 0.32;
  const clearlyBehind = rates.win < 0.28;
  const clearlyAhead = rates.win >= 0.58;
  const targets = raiseTargets(view, rates);

  for (const to of targets) {
    const add = to - view.my.roundBet;
    let score = raiseEV(view, rates, to, oppHand, tier);

    if (clearlyAhead) {
      // 가치: 승률↑·사이즈가 팟에 맞을수록 가산
      const ideal = view.pot * (rates.win >= 0.8 ? 1.1 : 0.75);
      score += 2.2 - Math.abs(add - ideal) / Math.max(1, view.pot) * 1.2;
      if (to === maxRaiseTo(view) && rates.win >= 0.82) score += 0.8; // 초강 잼
    } else if (rates.win >= 0.42 && rates.win < 0.58) {
      // 세미블러프/얇은 가치 — 중간 사이즈
      const ideal = view.pot * 0.55;
      score += 0.4 - Math.abs(add - ideal) / Math.max(1, view.pot);
    } else {
      // 블러프: 상대 노페어일 때만, 작은~중간. 더블+ 상대면 거의 버림
      if (oppRank >= 1) {
        score -= 4;
      } else {
        const bluffFreq =
          tier === '하' ? 0.08
            : tier === '중' ? 0.16
              : 0.24 + (1 - oppAggressiveness(view)) * 0.08;
        const ideal = view.pot * (tier === '상' ? 0.55 : 0.4);
        const sizeFit = 1 - Math.min(1, Math.abs(add - ideal) / Math.max(1, view.pot));
        if (Math.random() < bluffFreq) score += 1.1 + sizeFit * 0.8;
        else score -= 2.0;
        // +1 칩 블러프는 티나니 감점
        if (add <= 1 && view.pot >= 3) score -= 1.5;
      }
    }

    if (crushed || (clearlyBehind && oppRank >= 1)) score -= 5;
    if (tier === '하' && add > view.pot * 1.2) score -= 1.2;

    out.push({ action: { type: 'raise', amount: to }, score, label: `raise:${to}` });
  }

  return out;
}

/**
 * 룰·기본기 필터.
 * - 합법만
 * - 공개 더블+ & 낮은 승률 → 레이즈 금지, 콜도 팟오즈 나쁠 때 제거
 * - 앞서면 다이 금지
 */
function filterCompetent(
  view: IndianPokerDummyView,
  scored: ScoredAction[],
  rates: Rates,
  oppHand: IPHand,
): ScoredAction[] {
  const cost = callCostOf(view);
  const potOdds = cost > 0 ? cost / (view.pot + cost) : 0;
  const oppRank = HAND_RANK[oppHand];
  const diePen = expectedDiePenalty(rates.hand, view.my.chips);

  let list = scored.filter((s) => {
    if (s.action.type === 'check') return canCheck(view);
    if (s.action.type === 'call') {
      return cost > 0 && cost <= view.my.chips && !canCheck(view);
    }
    if (s.action.type === 'raise') {
      const a = s.action.amount;
      return a >= minRaiseTo(view) && a <= maxRaiseTo(view);
    }
    return true;
  });

  // 강한 분포에서 다이 금지
  if (rates.win >= 0.5) {
    const noDie = list.filter((s) => s.action.type !== 'die');
    if (noDie.length > 0) list = noDie;
  }

  // 상대 공개 메이드(더블+) + 우리 약함 → 공격 금지
  if (oppRank >= 1 && rates.win < 0.4) {
    list = list.filter((s) => s.action.type !== 'raise');
  }
  if (oppRank >= 1 && rates.win < 0.33) {
    // 콜은 팟 오즈가 아주 좋을 때만
    const equity = rates.win + rates.draw * 0.45;
    list = list.filter((s) => {
      if (s.action.type !== 'call') return true;
      return equity >= potOdds + 0.05;
    });
  }
  if (oppRank >= 2 && rates.win < 0.45) {
    list = list.filter((s) => s.action.type === 'die' || (s.action.type === 'check' && canCheck(view)));
  }

  // 콜 EV가 다이보다 명백히 나쁘면 콜 제거
  if (!canCheck(view) && cost > 0) {
    const cEV = callShowdownEV(rates, view.pot, cost);
    if (cEV < -diePen - 0.75) {
      list = list.filter((s) => s.action.type !== 'call');
    }
  }

  // +1만 올리는 레이즈는 팟이 있으면 제외 (티남). 최소=최대일 때만 허용.
  if (view.pot >= 3) {
    const minA = minRaiseTo(view);
    const maxA = maxRaiseTo(view);
    list = list.filter((s) => {
      if (s.action.type !== 'raise') return true;
      const add = s.action.amount - view.my.roundBet;
      if (add > 1) return true;
      return minA === maxA;
    });
  }

  if (list.length === 0) {
    if (canCheck(view)) return [{ action: { type: 'check' }, score: 0, label: 'check' }];
    const cEV = callShowdownEV(rates, view.pot, cost);
    if (cost > 0 && cost <= view.my.chips && cEV >= -diePen) {
      return [{ action: { type: 'call' }, score: cEV, label: 'call' }];
    }
    return [{ action: { type: 'die' }, score: -diePen, label: 'die' }];
  }
  return list;
}

function pickWeighted(scored: ScoredAction[], tier: DummyAiTier): IndianPokerAction {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0]!;
  const slack = tier === '하' ? 0.8 : tier === '중' ? 0.22 : 0.12;
  const band = sorted.filter((s) => s.score >= best.score - slack);
  const temp = tier === '하' ? 0.5 : tier === '중' ? 0.16 : 0.1;
  const weights = band.map((s) => Math.exp((s.score - best.score) / Math.max(0.05, temp)));
  let total = 0;
  for (const w of weights) total += w;
  let r = Math.random() * total;
  for (let i = 0; i < band.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return band[i]!.action;
  }
  return best.action;
}

/**
 * 공개 뷰만. 내 홀카드 금지.
 * MC로 승률·내 족보 분포 → 상대 공개 족보·팟오즈·벳사이즈·블러프 반영해 행동.
 */
export async function pickIndianPokerActionAsync(
  view: IndianPokerDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<IndianPokerAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.phase !== 'betting') return null;
  if (view.myId !== dummyId) return null;
  if (view.currentTurnId !== dummyId) return null;
  if (!view.communityCards || view.oppCard == null) return null;

  const pool = possibleMyCards(view.knownBurned);
  if (pool.length === 0) return null;

  const community = view.communityCards;
  const oppCard = view.oppCard;
  const oppHand = evaluateHand(oppCard, community);
  const acc = emptyAcc();

  await runPsychologySearch(budgetMs, () => {
    observe(acc, sampleCard(pool), oppCard, community, view.myId, view.oppId);
  });

  const rates = readRates(acc, tier);
  const scored = buildScoredActions(view, rates, oppHand, tier);
  const competent = filterCompetent(view, scored, rates, oppHand);
  return pickWeighted(competent, tier);
}
