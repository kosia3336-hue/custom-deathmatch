import type { DummyAiTier } from '@shared/dummy.js';
import type {
  BettingRpsAction,
  BRPSPhase,
  BRPSResult,
  BRPSRole,
  BRPSRoundRecord,
} from '@shared/types/betting-rps.js';
import { brpsMatchWinBonus } from '@shared/types/betting-rps.js';
import { runPsychologySearch } from '../psychologySearch.js';

export interface BettingRpsDummyView {
  gameOver: boolean;
  phase: BRPSPhase;
  round: number;
  totalRounds: number;
  myId: string;
  oppId: string;
  my: {
    chips: number;
    role: BRPSRole;
    hasChoiceRight: boolean;
    submitted: boolean;
  };
  opp: {
    chips: number;
    role: BRPSRole;
    hasChoiceRight: boolean;
    submitted: boolean;
  };
  /** 지난 라운드 전부 공개. 이번 라운드 상대 제출 없음 */
  roundHistory: BRPSRoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type Probs = { win: number; draw: number; lose: number };

const RESULTS: BRPSResult[] = ['win', 'draw', 'lose'];

/** 상대가 승부 역할일 때 prior (초반 승 선호, 무는 드묾) */
const MATCH_PRIOR: Probs = { win: 4.5, draw: 1.0, lose: 3.0 };

/** 상대가 베팅 역할일 때 prior */
const BET_PRIOR: Probs = { win: 4.0, draw: 0.8, lose: 3.5 };

function emptyProbs(): Probs {
  return { win: 0, draw: 0, lose: 0 };
}

function normalize(p: Probs): Probs {
  const t = p.win + p.draw + p.lose;
  if (t <= 0) return { win: 1 / 3, draw: 1 / 3, lose: 1 / 3 };
  return { win: p.win / t, draw: p.draw / t, lose: p.lose / t };
}

function argmax(scores: Probs): BRPSResult {
  if (scores.win >= scores.draw && scores.win >= scores.lose) return 'win';
  if (scores.draw >= scores.lose) return 'draw';
  return 'lose';
}

function softmaxSample(scores: Probs, temperature: number): BRPSResult {
  const maxS = Math.max(scores.win, scores.draw, scores.lose);
  const exps = RESULTS.map((k) => Math.exp((scores[k] - maxS) / Math.max(0.05, temperature)));
  const sum = exps.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < RESULTS.length; i++) {
    r -= exps[i]!;
    if (r <= 0) return RESULTS[i]!;
  }
  return 'win';
}

function tierKnobs(tier: DummyAiTier): {
  historyWeight: number;
  priorMix: number;
  sampleNoise: number;
  bestRate: number;
  softTemp: number;
  kellyFactor: number;
} {
  if (tier === '하') {
    return {
      historyWeight: 0.55,
      priorMix: 0.55,
      sampleNoise: 0.45,
      bestRate: 0.55,
      softTemp: 1.1,
      kellyFactor: 0.32,
    };
  }
  if (tier === '중') {
    return {
      historyWeight: 0.85,
      priorMix: 0.28,
      sampleNoise: 0.28,
      bestRate: 0.82,
      softTemp: 0.75,
      kellyFactor: 0.4,
    };
  }
  return {
    historyWeight: 1.15,
    priorMix: 0.12,
    sampleNoise: 0.16,
    bestRate: 0.95,
    softTemp: 0.45,
    kellyFactor: 0.45,
  };
}

/** 공개 이력에서 상대의 승부 선택 집계 (최근 라운드 가중) */
function oppMatchCounts(history: BRPSRoundRecord[], oppId: string): { counts: Probs; total: number } {
  const counts = emptyProbs();
  const rows = history.filter((r) => r.players[oppId]?.role === 'match' && r.players[oppId]?.matchResult);
  for (let i = 0; i < rows.length; i++) {
    const res = rows[i]!.players[oppId]!.matchResult!;
    const w = 1 + i / Math.max(1, rows.length - 1);
    counts[res] += w;
  }
  return { counts, total: counts.win + counts.draw + counts.lose };
}

function oppBetCounts(history: BRPSRoundRecord[], oppId: string): { counts: Probs; total: number } {
  const counts = emptyProbs();
  const rows = history.filter((r) => r.players[oppId]?.role === 'bet' && r.players[oppId]?.prediction);
  for (let i = 0; i < rows.length; i++) {
    const res = rows[i]!.players[oppId]!.prediction!;
    const w = 1 + i / Math.max(1, rows.length - 1);
    counts[res] += w;
  }
  return { counts, total: counts.win + counts.draw + counts.lose };
}

function estimateOppMatchProbs(view: BettingRpsDummyView, tier: DummyAiTier): Probs {
  const knobs = tierKnobs(tier);
  const { counts } = oppMatchCounts(view.roundHistory, view.oppId);
  const hist = {
    win: counts.win * knobs.historyWeight,
    draw: counts.draw * knobs.historyWeight,
    lose: counts.lose * knobs.historyWeight,
  };
  return normalize({
    win: MATCH_PRIOR.win * (1 + knobs.priorMix) + hist.win,
    draw: MATCH_PRIOR.draw * (1 + knobs.priorMix) + hist.draw,
    lose: MATCH_PRIOR.lose * (1 + knobs.priorMix) + hist.lose,
  });
}

function estimateOppBetProbs(view: BettingRpsDummyView, tier: DummyAiTier): Probs {
  const knobs = tierKnobs(tier);
  const { counts } = oppBetCounts(view.roundHistory, view.oppId);
  const hist = {
    win: counts.win * knobs.historyWeight,
    draw: counts.draw * knobs.historyWeight,
    lose: counts.lose * knobs.historyWeight,
  };
  return normalize({
    win: BET_PRIOR.win * (1 + knobs.priorMix) + hist.win,
    draw: BET_PRIOR.draw * (1 + knobs.priorMix) + hist.draw,
    lose: BET_PRIOR.lose * (1 + knobs.priorMix) + hist.lose,
  });
}

function estimateOppBetAmount(view: BettingRpsDummyView): number {
  if (view.opp.chips === 0) return 0;
  const bets: number[] = [];
  for (const r of view.roundHistory) {
    const p = r.players[view.oppId];
    if (p?.role === 'bet' && p.betChips != null) bets.push(p.betChips);
  }
  if (bets.length === 0) return Math.max(1, Math.round(view.opp.chips * 0.35));
  return Math.max(1, Math.round(bets.reduce((a, b) => a + b, 0) / bets.length));
}

/** 베팅 1칩당 기대 순이득 (상대 승부 분포 기준) */
function calcBetEVPerChip(mp: Probs): Probs {
  return {
    win: mp.win - mp.lose,
    draw: 3 * mp.draw - 1,
    lose: mp.lose - mp.win,
  };
}

function calcKellyFractions(mp: Probs): Probs {
  return {
    win: Math.max(0, mp.win - mp.lose),
    draw: Math.max(0, (3 * mp.draw - 1) / 2),
    lose: Math.max(0, mp.lose - mp.win),
  };
}

/** 승부 선택 시 내 칩갭 변화 기대 (상대 베팅 성향 카운터) */
function calcMatchNetScores(round: number, betProbs: Probs, avgBet: number): Probs {
  const bonus = brpsMatchWinBonus(round);
  const { win: qw, draw: qd, lose: ql } = betProbs;
  return {
    win: bonus - avgBet * (2 * qw - 1),
    draw: -2 * avgBet * qd,
    lose: -avgBet * (2 * ql - 1),
  };
}

function jitterProbs(base: Probs, noise: number): Probs {
  return normalize({
    win: Math.max(0.01, base.win * (1 + (Math.random() * 2 - 1) * noise)),
    draw: Math.max(0.01, base.draw * (1 + (Math.random() * 2 - 1) * noise)),
    lose: Math.max(0.01, base.lose * (1 + (Math.random() * 2 - 1) * noise)),
  });
}

function pickWithTier(scores: Probs, tier: DummyAiTier): BRPSResult {
  const knobs = tierKnobs(tier);
  if (Math.random() < knobs.bestRate) return argmax(scores);
  return softmaxSample(scores, knobs.softTemp);
}

function roundsLeft(view: BettingRpsDummyView): number {
  return view.totalRounds - view.round;
}

function decideRoleFromScores(matchScore: number, betScore: number, tier: DummyAiTier): 'match' | 'bet' {
  const diff = matchScore - betScore;
  const knobs = tierKnobs(tier);
  if (diff > 0.5) return Math.random() < knobs.bestRate ? 'match' : 'bet';
  if (diff < -0.5) return Math.random() < knobs.bestRate ? 'bet' : 'match';
  return Math.random() < (diff >= 0 ? 0.6 : 0.4) ? 'match' : 'bet';
}

function buildBetChipCandidates(chips: number, left: number): number[] {
  if (chips <= 0) return [0];
  const set = new Set<number>();
  set.add(1);
  if (chips >= 2) set.add(2);
  const frac = [0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1];
  for (const f of frac) {
    let b = Math.max(1, Math.ceil(chips * f));
    if (left > 1 && b >= chips) b = chips - 1;
    set.add(Math.max(1, Math.min(chips, b)));
  }
  if (left <= 1) set.add(chips);
  return [...set].filter((c) => c >= 1 && c <= chips).sort((a, b) => a - b);
}

/**
 * 공개: 칩·역할·과거 라운드. 이번 상대 제출 금지.
 * budgetMs 동안 상대 분포를 지터하며 역할/승부/베팅 EV를 쌓은 뒤 카운터 선택.
 */
export async function pickBettingRpsActionAsync(
  view: BettingRpsDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<BettingRpsAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;

  const knobs = tierKnobs(tier);

  if (view.phase === 'roleSelect') {
    if (!view.my.hasChoiceRight) return null;

    // 하드 룰: 칩 없으면 / 상대 칩 없으면 승부
    if (view.my.chips === 0 || view.opp.chips === 0) {
      return { type: 'selectRole', role: 'match' };
    }

    let matchAcc = 0;
    let betAcc = 0;
    const baseBet = estimateOppBetProbs(view, tier);
    const baseMatch = estimateOppMatchProbs(view, tier);
    const avgBet0 = estimateOppBetAmount(view);
    const bonus = brpsMatchWinBonus(view.round);

    await runPsychologySearch(budgetMs, () => {
      const betProbs = jitterProbs(baseBet, knobs.sampleNoise);
      const matchProbs = jitterProbs(baseMatch, knobs.sampleNoise);
      const avgBet = Math.max(0, Math.round(avgBet0 * (0.7 + Math.random() * 0.6)));

      const net = calcMatchNetScores(view.round, betProbs, avgBet);
      matchAcc += Math.max(net.win, net.draw, net.lose);

      const evs = calcBetEVPerChip(matchProbs);
      const kellys = calcKellyFractions(matchProbs);
      const bestPred = argmax(evs);
      const bestEV = evs[bestPred];
      const safeKelly = kellys[bestPred] * knobs.kellyFactor;
      const aiGain = bestEV > 0 ? bestEV * safeKelly * view.my.chips : 0;
      const oppMatchGain = matchProbs.win * bonus;
      betAcc += aiGain - oppMatchGain;
    });

    const role = decideRoleFromScores(matchAcc, betAcc, tier);
    return { type: 'selectRole', role };
  }

  if (view.phase !== 'submit' || view.my.submitted) return null;
  if (!view.my.role) return null;

  if (view.my.role === 'match') {
    const baseBet = estimateOppBetProbs(view, tier);
    const avgBet0 = estimateOppBetAmount(view);
    const acc: Probs = emptyProbs();

    await runPsychologySearch(budgetMs, () => {
      const betProbs = jitterProbs(baseBet, knobs.sampleNoise);
      const avgBet = Math.max(0, Math.round(avgBet0 * (0.7 + Math.random() * 0.6)));
      const net = calcMatchNetScores(view.round, betProbs, avgBet);
      acc.win += net.win;
      acc.draw += net.draw;
      acc.lose += net.lose;
    });

    return { type: 'submitMatch', result: pickWithTier(acc, tier) };
  }

  // bet role
  if (view.my.chips === 0) {
    return { type: 'submitBet', prediction: 'win', chips: 0 };
  }

  const baseMatch = estimateOppMatchProbs(view, tier);
  const left = roundsLeft(view);
  const chipGap = view.my.chips - view.opp.chips;
  const predAcc: Probs = emptyProbs();
  const chipCands = buildBetChipCandidates(view.my.chips, left);
  const chipAcc = new Map<string, number>(); // `${pred}:${chips}`

  await runPsychologySearch(budgetMs, () => {
    const matchProbs = jitterProbs(baseMatch, knobs.sampleNoise);
    const evs = calcBetEVPerChip(matchProbs);
    predAcc.win += evs.win;
    predAcc.draw += evs.draw;
    predAcc.lose += evs.lose;

    for (const pred of RESULTS) {
      for (const chips of chipCands) {
        // 성공 기대: win/lose → +chips, draw → +2chips; 실패 → -chips; 환불(승/패 예측·무) → 0
        // EV ≈ chips * evPerChip(pred)  (환불·배율 반영된 per-chip EV)
        let s = chips * evs[pred];
        // 자원: 리드면 큰 베팅 감점, 열세·막판이면 가산
        if (chipGap >= 3 && chips > view.my.chips * 0.4) s -= 0.35;
        if (chipGap <= -2 && chips >= Math.ceil(view.my.chips * 0.35)) s += 0.2;
        if (left > 1 && chips >= view.my.chips) s -= 1.5;
        const key = `${pred}:${chips}`;
        chipAcc.set(key, (chipAcc.get(key) ?? 0) + s);
      }
    }
  });

  const prediction = pickWithTier(predAcc, tier);

  // 예측 고정 후 칩: 해당 예측 키만, 켈리 앵커 근처 가산
  const kellys = calcKellyFractions(normalize({
    win: Math.max(0.01, predAcc.win),
    draw: Math.max(0.01, predAcc.draw),
    lose: Math.max(0.01, predAcc.lose),
  }));
  let factor = knobs.kellyFactor;
  if (chipGap >= 3) factor = Math.min(factor, 0.22);
  if (chipGap <= -3) factor = Math.max(factor, 0.55);
  if (chipGap < 0 && left <= 2) factor = Math.max(factor, 0.8);
  if (left <= 1) factor = 1;

  const kellyFrac = kellys[prediction];
  let anchor = kellyFrac > 0
    ? Math.ceil(view.my.chips * Math.min(kellyFrac * factor, 1))
    : 1;
  if (left > 1 && anchor >= view.my.chips) anchor = view.my.chips - 1;
  anchor = Math.max(1, Math.min(view.my.chips, anchor));

  let bestChips = anchor;
  let bestScore = -Infinity;
  for (const chips of chipCands) {
    const key = `${prediction}:${chips}`;
    let s = chipAcc.get(key) ?? -999;
    // 앵커 근처 보너스
    s -= Math.abs(chips - anchor) * 0.08;
    if (s > bestScore) {
      bestScore = s;
      bestChips = chips;
    }
  }

  // 하: 가끔 차선 칩
  if (tier === '하' && Math.random() < 0.35 && chipCands.length > 1) {
    const near = chipCands.filter((c) => Math.abs(c - bestChips) <= 2 && c !== bestChips);
    if (near.length > 0) bestChips = near[Math.floor(Math.random() * near.length)]!;
  } else if (tier === '중' && Math.random() < 0.15 && chipCands.length > 1) {
    const near = chipCands.filter((c) => Math.abs(c - bestChips) <= 1 && c !== bestChips);
    if (near.length > 0) bestChips = near[Math.floor(Math.random() * near.length)]!;
  }

  return {
    type: 'submitBet',
    prediction,
    chips: Math.max(1, Math.min(view.my.chips, bestChips)),
  };
}
