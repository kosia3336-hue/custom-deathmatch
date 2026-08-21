import type { DummyAiTier } from '@shared/dummy.js';
import type {
  GS2Action,
  GS2CardId,
  GS2Phase,
  GS2PlayerAction,
  GS2RoundRecord,
} from '@shared/types/grape-sugar-2.js';
import { resolveRound } from '../../socket/games/grape-sugar-2/resolve.js';
import { runPsychologySearch } from '../psychologySearch.js';

/**
 * 운영 기보 `game_logs` game-012 · multi · 전적 집계 420판.
 * 이번 라운드 pending 은 안 본다. 잔여 카드는 UI 배지와 같이 공개.
 */

export interface GrapeSugar2DummyView {
  gameOver: boolean;
  phase: GS2Phase;
  round: number;
  maxRound: 8 | 9;
  extension: number;
  myId: string;
  oppId: string;
  mySide: 'p1' | 'p2';
  my: {
    score: number;
    sugarRemain: number;
    hand: GS2CardId[];
    submitted: boolean;
    hrPenaltyPending: number;
  };
  /** UI가 잔여 카드 종류를 보여 줌. 이번 pending 없음 */
  opp: {
    score: number;
    sugarRemain: number;
    hand: GS2CardId[];
    submitted: boolean;
    hrPenaltyPending: number;
  };
  breathAvailable: boolean;
  history: GS2RoundRecord[];
  winner: string | 'tie' | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type Cand = { action: Extract<GS2Action, { type: 'submit' }>; key: string };

/** 기보 라운드별 카드 장수 (본게임 p1+p2, R3–6·9는 p1×상대비율과 같은 분포) */
const ROUND_W: Record<number, Record<GS2CardId, number>> = {
  1: { grapeBless: 131, noAction: 138, spaceCrush: 124, minus3: 108, plus5: 97, highRisk: 74, copy: 62, earthCrush: 57, breath: 34, dice: 3 },
  2: { grapeBless: 123, minus3: 107, plus5: 100, noAction: 99, highRisk: 89, spaceCrush: 71, breath: 70, earthCrush: 56, copy: 55, dice: 2 },
  3: { minus3: 66, plus5: 55, noAction: 54, spaceCrush: 51, grapeBless: 44, breath: 43, highRisk: 23, copy: 22, earthCrush: 18, dice: 1 },
  4: { plus5: 60, highRisk: 42, spaceCrush: 41, breath: 39, noAction: 38, minus3: 38, copy: 36, earthCrush: 32, grapeBless: 31, dice: 2 },
  5: { copy: 43, highRisk: 42, minus3: 41, plus5: 39, noAction: 39, earthCrush: 38, spaceCrush: 36, grapeBless: 29, breath: 29, dice: 2 },
  6: { earthCrush: 47, breath: 39, plus5: 38, minus3: 34, noAction: 34, highRisk: 32, spaceCrush: 30, copy: 28, grapeBless: 24, dice: 15 },
  7: { copy: 110, earthCrush: 79, spaceCrush: 76, breath: 72, noAction: 56, minus3: 51, highRisk: 51, plus5: 47, grapeBless: 45, dice: 27 },
  8: { highRisk: 92, copy: 83, dice: 72, earthCrush: 64, grapeBless: 52, breath: 50, noAction: 49, spaceCrush: 48, minus3: 36, plus5: 34 },
  9: { dice: 90, earthCrush: 62, highRisk: 60, grapeBless: 50, copy: 46, spaceCrush: 40, breath: 38, minus3: 30, noAction: 28, plus5: 18 },
};

const SUGAR_TYPICAL: Record<GS2CardId, { mode: number; spread: number }> = {
  spaceCrush: { mode: 1, spread: 1 },
  noAction: { mode: 1, spread: 1 },
  breath: { mode: 1, spread: 1 },
  plus5: { mode: 2, spread: 2 },
  minus3: { mode: 1, spread: 2 },
  dice: { mode: 1, spread: 3 },
  copy: { mode: 6, spread: 3 },
  highRisk: { mode: 6, spread: 3 },
  grapeBless: { mode: 9, spread: 4 },
  earthCrush: { mode: 6, spread: 3 },
};

const CHEAP: ReadonlySet<GS2CardId> = new Set(['spaceCrush', 'noAction', 'breath']);

function tierKnobs(tier: DummyAiTier): { uniformMix: number; softmaxTemp: number; sugarNoise: number } {
  if (tier === '하') return { uniformMix: 0.42, softmaxTemp: 0.08, sugarNoise: 0.45 };
  if (tier === '중') return { uniformMix: 0.16, softmaxTemp: 0.03, sugarNoise: 0.28 };
  return { uniformMix: 0.05, softmaxTemp: 0.012, sugarNoise: 0.16 };
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1 / (1 + Math.exp(-x));
}

function roundWeights(round: number): Record<GS2CardId, number> {
  return ROUND_W[round] ?? ROUND_W[8]!;
}

function isLastScheduled(view: GrapeSugar2DummyView): boolean {
  return view.round >= view.maxRound;
}

/** 상대 잔여가 그 카드뿐이면 치킨 확정패. 유일한 내 카드면 금지하지 않음. */
export function isFatalChicken(view: GrapeSugar2DummyView, card: GS2CardId): boolean {
  if (view.my.hand.length <= 1) return false;
  const opp = view.opp.hand;
  if (opp.length === 0) return false;
  if (card === 'spaceCrush' && opp.every((c) => c === 'noAction')) return true;
  if (card === 'noAction' && opp.every((c) => c === 'spaceCrush')) return true;
  return false;
}

/** 리드인데 숨고르기로 연장/값싼 노옵. 유일한 카드면 허용. */
export function isWastedBreath(view: GrapeSugar2DummyView, card: GS2CardId): boolean {
  if (card !== 'breath') return false;
  if (view.my.hand.length <= 1) return false;
  if (!view.breathAvailable) return true;
  if (view.my.score > view.opp.score && view.round >= view.maxRound - 1) return true;
  return false;
}

function addSugar(set: Set<number>, v: number, remain: number, cap: number): void {
  if (v < 0 || v > remain || v > cap) return;
  set.add(Math.floor(v));
}

const CARD_P95: Record<GS2CardId, number> = {
  grapeBless: 13,
  highRisk: 11,
  copy: 10,
  earthCrush: 9,
  dice: 8,
  plus5: 5,
  minus3: 5,
  breath: 3,
  noAction: 3,
  spaceCrush: 2,
};

/**
 * 기보: R1–5에서 설탕 ≥20은 0회, R1 p95=11.
 * 마지막 라운드만 잔여 전부. 그 전에는 카드 p95 + 남은 라운드 연료.
 */
export function sugarSoftCap(
  card: GS2CardId,
  remain: number,
  roundsLeft: number,
  lastRound: boolean,
  scoreDiff: number,
): number {
  if (remain <= 0) return 0;
  if (lastRound || roundsLeft <= 1) return remain;

  const minSpend = CHEAP.has(card) ? 1 : 2;
  const per = roundsLeft >= 5 ? 2.5 : roundsLeft >= 3 ? 2.0 : 1.2;
  const keep = Math.min(Math.max(0, remain - minSpend), Math.ceil((roundsLeft - 1) * per));
  const fuelCap = remain - keep;
  const roundCap = roundsLeft >= 6 ? 12 : roundsLeft >= 4 ? 12 : roundsLeft >= 3 ? 14 : 18;
  let cap = Math.min(remain, CARD_P95[card], roundCap, Math.max(minSpend, fuelCap));
  if (scoreDiff <= -2 && roundsLeft <= 3) {
    cap = Math.min(remain, cap + 4);
  }
  return Math.max(0, Math.floor(cap));
}

export function sugarCandidates(
  card: GS2CardId,
  remain: number,
  roundsLeft: number,
  lastRound: boolean,
  scoreDiff = 0,
): number[] {
  const cap = sugarSoftCap(card, remain, roundsLeft, lastRound, scoreDiff);
  const set = new Set<number>();
  const t = SUGAR_TYPICAL[card];
  addSugar(set, 0, remain, cap);
  addSugar(set, 1, remain, cap);
  addSugar(set, t.mode, remain, cap);
  addSugar(set, t.mode - t.spread, remain, cap);
  addSugar(set, Math.min(t.mode + t.spread, cap), remain, cap);
  const pace = Math.min(cap, Math.floor(remain / Math.max(1, roundsLeft)));
  addSugar(set, pace, remain, cap);
  addSugar(set, Math.max(1, pace - 1), remain, cap);
  addSugar(set, pace + 1, remain, cap);

  if (CHEAP.has(card)) {
    addSugar(set, Math.min(2, remain, cap), remain, cap);
  } else if (lastRound || roundsLeft <= 1) {
    addSugar(set, remain, remain, cap);
    if (remain >= 2) addSugar(set, remain - 1, remain, cap);
  } else {
    addSugar(set, cap, remain, cap);
    addSugar(set, Math.min(remain, t.mode + 2, cap), remain, cap);
  }

  if ((card === 'copy' || card === 'highRisk') && remain >= 2) {
    set.delete(0);
  }
  if (card === 'spaceCrush' && remain >= 1) {
    set.delete(0);
  }

  const out = [...set].filter((s) => s <= cap).sort((a, b) => a - b);
  if (out.length > 0) return out;
  return [Math.min(remain, cap, CHEAP.has(card) ? 1 : Math.max(1, pace))];
}

export function candidates(view: GrapeSugar2DummyView): Cand[] {
  const remain = view.my.sugarRemain;
  const roundsLeft = Math.max(1, view.maxRound - view.round + 1);
  const last = isLastScheduled(view) && !view.breathAvailable;
  const scoreDiff = view.my.score - view.opp.score;
  const out: Cand[] = [];
  for (const card of view.my.hand) {
    if (isFatalChicken(view, card)) continue;
    if (isWastedBreath(view, card)) continue;
    for (const sugar of sugarCandidates(card, remain, roundsLeft, last || isLastScheduled(view), scoreDiff)) {
      out.push({
        action: { type: 'submit', card, sugar },
        key: `${card}:${sugar}`,
      });
    }
  }
  if (out.length === 0) {
    const card = view.my.hand[0] ?? 'noAction';
    const sugar = Math.min(remain, CHEAP.has(card) ? Math.min(1, remain) : remain);
    out.push({ action: { type: 'submit', card, sugar }, key: `${card}:${sugar}` });
  }
  return out;
}

function sampleWeighted(hand: GS2CardId[], weights: number[]): GS2CardId {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return hand[Math.floor(Math.random() * hand.length)] ?? 'noAction';
  let r = Math.random() * total;
  for (let i = 0; i < hand.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return hand[i]!;
  }
  return hand[hand.length - 1]!;
}

function oppCardWeights(view: GrapeSugar2DummyView, uniformMix: number): number[] {
  const wRound = roundWeights(view.round);
  return view.opp.hand.map((c) => {
    const prior = Math.max(1, wRound[c] ?? 8);
    return prior * (1 - uniformMix) + 20 * uniformMix;
  });
}

function oppSugarFromHistory(view: GrapeSugar2DummyView): number | null {
  if (view.history.length === 0) return null;
  const oppSide = view.mySide === 'p1' ? 'p2' : 'p1';
  const last = view.history.slice(-2);
  const vals = last.map((r) => r.actions[oppSide].sugar);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sampleOppSugar(
  card: GS2CardId,
  remain: number,
  roundsLeft: number,
  lastRound: boolean,
  histMean: number | null,
  noise: number,
  scoreDiff: number,
): number {
  const cap = sugarSoftCap(card, remain, roundsLeft, lastRound, scoreDiff);
  const t = SUGAR_TYPICAL[card];
  let mode = t.mode;
  if (histMean != null) mode = mode * 0.7 + histMean * 0.3;
  if ((lastRound || roundsLeft <= 1) && !CHEAP.has(card) && Math.random() < 0.55) {
    return remain;
  }
  let s = mode + (Math.random() * 2 - 1) * (t.spread + mode * noise);
  if (CHEAP.has(card)) s = Math.min(s, 2);
  if ((card === 'copy' || card === 'highRisk') && remain >= 1) {
    s = Math.max(1, s);
  }
  if (card === 'spaceCrush' && remain >= 1) s = Math.max(1, s);
  return clampInt(s, 0, Math.min(remain, cap));
}

function sampleOppPlay(
  view: GrapeSugar2DummyView,
  knobs: ReturnType<typeof tierKnobs>,
): GS2PlayerAction {
  const hand = view.opp.hand;
  if (hand.length === 0) {
    return { card: 'noAction', sugar: 0 };
  }
  const weights = oppCardWeights(view, knobs.uniformMix);
  const card = sampleWeighted(hand, weights);
  const roundsLeft = Math.max(1, view.maxRound - view.round + 1);
  const sugar = sampleOppSugar(
    card,
    view.opp.sugarRemain,
    roundsLeft,
    isLastScheduled(view),
    oppSugarFromHistory(view),
    knobs.sugarNoise,
    view.opp.score - view.my.score,
  );
  return { card, sugar };
}

function applyHr(sugar: number, pending: number, oppSugar: number): { me: number; opp: number } {
  if (pending <= 0) return { me: sugar, opp: oppSugar };
  const t = Math.min(pending, sugar);
  return { me: sugar - t, opp: oppSugar + t };
}

function pWinAfter(
  myScore: number,
  oppScore: number,
  mySugar: number,
  oppSugar: number,
  myHand: GS2CardId[],
  oppHand: GS2CardId[],
  roundsLeft: number,
): number {
  if (roundsLeft <= 0) {
    if (myScore > oppScore) return 1;
    if (myScore < oppScore) return 0;
    return 0.5;
  }
  const myPace = mySugar / roundsLeft;
  const oppPace = oppSugar / roundsLeft;
  let fuel = myPace - oppPace;
  if (mySugar < roundsLeft * 2 && oppSugar >= mySugar + 10) fuel -= 2.2;
  if (oppSugar < roundsLeft * 2 && mySugar >= oppSugar + 10) fuel += 2.2;

  let x = (myScore - oppScore) * 0.85 + fuel * 0.7;
  const myHr = myHand.includes('highRisk');
  const oppHr = oppHand.includes('highRisk');
  const mySc = myHand.includes('spaceCrush');
  const oppSc = oppHand.includes('spaceCrush');
  const myNa = myHand.includes('noAction');
  const oppNa = oppHand.includes('noAction');
  if (myHr && !oppSc) x += 0.4;
  if (oppHr && !mySc) x -= 0.4;
  if (myHand.includes('copy') && !oppSc && !oppHr) x += 0.18;
  if (oppHand.includes('copy') && !mySc && !myHr) x -= 0.18;
  if (myNa && oppSc) x += 0.12;
  if (oppNa && mySc) x -= 0.12;
  if (roundsLeft <= 2) x *= 1.15;
  return sigmoid(x);
}

function evalSubmit(
  view: GrapeSugar2DummyView,
  mine: GS2PlayerAction,
  opp: GS2PlayerAction,
): number {
  const isFinalRound = view.round >= view.maxRound;
  const result = resolveRound(mine, opp, {
    breathAvailable: view.breathAvailable,
    isFinalRound,
    rollDice: () => (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  });

  if (result.instantWin === 'p1') return 1;
  if (result.instantWin === 'p2') return 0;

  const myScore = view.my.score + result.scoreDelta.p1;
  const oppScore = view.opp.score + result.scoreDelta.p2;
  let mySugar = view.my.sugarRemain - mine.sugar;
  let oppSugar = view.opp.sugarRemain - opp.sugar;
  const hrMe = applyHr(mySugar, result.hrPenaltyScheduled.p1, oppSugar);
  mySugar = hrMe.me;
  oppSugar = hrMe.opp;
  const hrOpp = applyHr(oppSugar, result.hrPenaltyScheduled.p2, mySugar);
  oppSugar = hrOpp.me;
  mySugar = hrOpp.opp;

  const myHand = view.my.hand.filter((c) => c !== mine.card);
  const oppHand = view.opp.hand.filter((c) => c !== opp.card);

  let maxRound = view.maxRound;
  if (result.breathExtended) maxRound = 9;
  const roundsLeft = Math.max(0, maxRound - view.round);

  let p = pWinAfter(myScore, oppScore, mySugar, oppSugar, myHand, oppHand, roundsLeft);
  if (roundsLeft <= 0 && !CHEAP.has(mine.card)) {
    p += mine.sugar * 0.00012;
  }
  return p;
}

function pickSoftmax(scored: Array<{ cand: Cand; score: number }>, tier: DummyAiTier, temp: number): Cand {
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return { action: { type: 'submit', card: 'noAction', sugar: 0 }, key: 'noAction:0' };
  }
  if (tier === '상') {
    if (scored.length > 1 && Math.random() < 0.05 && scored[0]!.score - scored[1]!.score < 0.03) {
      return scored[1]!.cand;
    }
    return scored[0]!.cand;
  }
  const t = Math.max(0.008, temp);
  const maxS = scored[0]!.score;
  const weights = scored.map((x) => Math.exp((x.score - maxS) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return scored[i]!.cand;
  }
  return scored[scored.length - 1]!.cand;
}

export async function pickGrapeSugar2ActionAsync(
  view: GrapeSugar2DummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<GS2Action | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  if (view.phase !== 'input' || view.my.submitted) return null;
  if (view.my.hand.length === 0) {
    return { type: 'submit', card: 'noAction', sugar: 0 };
  }

  const cands = candidates(view);
  const knobs = tierKnobs(tier);
  const acc = new Map<string, { cand: Cand; sum: number; n: number }>();
  for (const c of cands) acc.set(c.key, { cand: c, sum: 0, n: 0 });

  await runPsychologySearch(budgetMs, () => {
    const opp = sampleOppPlay(view, knobs);
    for (const c of cands) {
      const sc = evalSubmit(view, { card: c.action.card, sugar: c.action.sugar }, opp);
      const a = acc.get(c.key)!;
      a.sum += sc;
      a.n += 1;
    }
  }, { batchSize: 16 });

  const scored = [...acc.values()]
    .filter((a) => a.n > 0)
    .map((a) => ({ cand: a.cand, score: a.sum / a.n }));
  if (scored.length === 0) {
    const card = view.my.hand[0]!;
    return { type: 'submit', card, sugar: Math.min(view.my.sugarRemain, 1) };
  }

  const picked = pickSoftmax(scored, tier, knobs.softmaxTemp).action;
  if (!view.my.hand.includes(picked.card)) {
    return { type: 'submit', card: view.my.hand[0]!, sugar: 0 };
  }
  const roundsLeft = Math.max(1, view.maxRound - view.round + 1);
  const last = isLastScheduled(view) && !view.breathAvailable;
  const cap = sugarSoftCap(
    picked.card,
    view.my.sugarRemain,
    roundsLeft,
    last || isLastScheduled(view),
    view.my.score - view.opp.score,
  );
  const sugar = clampInt(picked.sugar, 0, Math.min(view.my.sugarRemain, cap));
  return { type: 'submit', card: picked.card, sugar };
}
