import type { DummyAiTier } from '@shared/dummy.js';
import type {
  WSCardCount,
  WSCardType,
  WSMatchResult,
  WSPhase,
  WSRoundRecord,
  WinningStreakAction,
} from '@shared/types/winning-streak.js';
import { CARD_TYPES } from '@shared/types/winning-streak.js';
import { getMatchupResult } from '../../socket/games/winning-streak/judge.js';
import { dummyStyle, pickWeighted, type DummyStyle } from '../style.js';
import { runPsychologySearch } from '../psychologySearch.js';

export interface WinningStreakDummyView {
  gameOver: boolean;
  phase: WSPhase;
  round: number;
  totalRounds: number;
  myId: string;
  oppId: string;
  my: {
    currentStreak: number;
    maxStreak: number;
    totalWins: number;
    remainingCards: WSCardCount;
    lastPlayedCard: WSCardType | null;
    submitted: boolean;
  };
  /** UI에 잔여 ×장수·직전 카드·연승 공개 */
  opp: {
    currentStreak: number;
    maxStreak: number;
    totalWins: number;
    remainingCards: WSCardCount;
    lastPlayedCard: WSCardType | null;
    submitted: boolean;
  };
  roundHistory: WSRoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

type Bag = Array<{ card: WSCardType; count: number }>;

function isWinResult(r: WSMatchResult): boolean {
  return r === 'win' || r === 'draw_win';
}

function isSuit(card: WSCardType): boolean {
  return card !== 'colorJoker' && card !== 'blackJoker';
}

function roundsLeft(view: WinningStreakDummyView): number {
  return view.totalRounds - view.round + 1;
}

/**
 * 이번 라운드부터 전승해도 상대 최대연승을 못 따라가면 수학적으로 패배.
 * 예: 4장 남음(4라운드)인데 상대 이미 5연승, 내 현재 연승 0.
 */
export function isWinningStreakHopeless(view: WinningStreakDummyView): boolean {
  const left = roundsLeft(view);
  const myBestMax = Math.max(view.my.maxStreak, view.my.currentStreak + left);
  if (myBestMax < view.opp.maxStreak) return true;
  // 최대연승이 이미 동률로 고정이고, 전승해도 총승을 못 따라감
  if (myBestMax === view.my.maxStreak && view.my.maxStreak === view.opp.maxStreak) {
    if (view.my.totalWins + left < view.opp.totalWins) return true;
  }
  return false;
}

export function isWinningStreakLastRound(view: WinningStreakDummyView): boolean {
  return view.round >= view.totalRounds;
}

function availableCards(cards: WSCardCount, lastPlayed: WSCardType | null): WSCardType[] {
  const available: WSCardType[] = [];
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    if (ct === lastPlayed) continue;
    available.push(ct);
  }
  if (available.length === 0 && lastPlayed && cards[lastPlayed] > 0) {
    available.push(lastPlayed);
  }
  return available;
}

/** 이번 턴에 낼 수 있는 장 (연속 금지 적용) */
function legalBag(cards: WSCardCount, lastPlayed: WSCardType | null): Bag {
  const result: Bag = [];
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    if (ct === lastPlayed) continue;
    result.push({ card: ct, count: cards[ct] });
  }
  if (result.length === 0 && lastPlayed && cards[lastPlayed] > 0) {
    result.push({ card: lastPlayed, count: cards[lastPlayed] });
  }
  return result;
}

/** 손에 남은 전부 (다음 턴에 풀리는 잠금 장 포함) */
function fullBag(cards: WSCardCount): Bag {
  const result: Bag = [];
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    result.push({ card: ct, count: cards[ct] });
  }
  return result;
}

function bagTotal(bag: Bag): number {
  return bag.reduce((s, p) => s + p.count, 0);
}

function matchStats(myCard: WSCardType, bag: Bag): {
  total: number;
  win: number;
  lose: number;
  guaranteedWin: boolean;
  guaranteedLoss: boolean;
  pWin: number;
  pColor: number;
} {
  let total = 0;
  let win = 0;
  let lose = 0;
  let color = 0;
  for (const p of bag) {
    total += p.count;
    if (p.card === 'colorJoker') color += p.count;
    if (isWinResult(getMatchupResult(myCard, p.card))) win += p.count;
    else lose += p.count;
  }
  return {
    total,
    win,
    lose,
    guaranteedWin: total > 0 && win === total,
    guaranteedLoss: total > 0 && lose === total,
    pWin: total > 0 ? win / total : 0.5,
    pColor: total > 0 ? color / total : 0,
  };
}

/** 상대가 가진 장만. 장수에 노이즈를 넣지 않는다. 성향은 가중치만. */
function policyWeight(card: WSCardType, view: WinningStreakDummyView): number {
  if (card === 'colorJoker') {
    if (view.opp.currentStreak >= 3) return 2.4;
    if (view.opp.currentStreak <= 1) return 0.45;
    return 0.85;
  }
  if (card === 'blackJoker' && view.opp.currentStreak >= 2) return 0.2;
  return 1;
}

function sampleOppCard(bag: Bag, view: WinningStreakDummyView, policyMix: number): WSCardType | null {
  if (bag.length === 0) return null;
  let total = 0;
  const weights = bag.map((p) => {
    const w = p.count * (1 - policyMix + policyMix * policyWeight(p.card, view));
    return Math.max(0.001, w);
  });
  total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < bag.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return bag[i]!.card;
  }
  return bag[bag.length - 1]!.card;
}

function colorSavePenalty(view: WinningStreakDummyView, suitCount: number): number {
  if (suitCount === 0) return 0;
  if (isWinningStreakHopeless(view)) return -0.2;
  const streak = view.my.currentStreak;
  const left = roundsLeft(view);
  let p = streak >= 3 ? -0.5 : streak === 2 ? -2.3 : -2.6;
  if (breakWindow(view) && streak < 3) p = -0.2;
  if (left <= 2 && view.my.maxStreak < view.opp.maxStreak) p += 1.05;
  if (view.my.maxStreak >= view.opp.maxStreak + 2 && streak < 3) p -= 0.25;
  return p;
}

/** R1~2 털기: ♥/♠ 위주, ♣/♦ 섞고, 흑백은 드묾. 컬러는 거의 안 냄. */
function openingWeight(card: WSCardType, style: DummyStyle): number {
  if (card === 'heart') return 1.3 + style.dump * 0.35;
  if (card === 'spade') return 1.15 + style.dump * 0.25;
  if (card === 'club') return 0.55 + Math.max(0, style.aggression) * 0.7;
  if (card === 'diamond') return 0.5 + Math.max(0, style.aggression) * 0.65;
  if (card === 'blackJoker') return 0.07 + style.dump * 0.1;
  if (card === 'colorJoker') return 0.02;
  return 0.4;
}

function dumpWindow(view: WinningStreakDummyView): boolean {
  return view.my.currentStreak === 0 && view.opp.currentStreak <= 1;
}

function breakWindow(view: WinningStreakDummyView): boolean {
  return (
    view.opp.currentStreak >= 3
    || (view.opp.currentStreak >= 2 && view.opp.maxStreak >= view.my.maxStreak)
  );
}

function extendWindow(view: WinningStreakDummyView): boolean {
  return view.my.currentStreak >= 3;
}

function matchupScale(view: WinningStreakDummyView): number {
  if (breakWindow(view)) return 1.4;
  if (extendWindow(view)) return 1.2;
  if (dumpWindow(view)) return 0.18;
  return 0.75; // 내 1~2연승: 쌓되 강한 패를 공짜승에 쓰지 않음
}

/** 상대 손 전체 기준 강약. 컬러=1, 흑백=0. 유일 카운터면 강함. */
function cardStrength(
  myCard: WSCardType,
  myRemaining: WSCardCount,
  oppFull: Bag,
): number {
  if (myCard === 'colorJoker') return 1;
  if (myCard === 'blackJoker') return 0;
  const pWin = matchStats(myCard, oppFull).pWin;
  const mine: WSCardType[] = [];
  for (const ct of CARD_TYPES) {
    if (myRemaining[ct] > 0) mine.push(ct);
  }
  let uniqueMass = 0;
  for (const p of oppFull) {
    const beaters = mine.filter((c) => isWinResult(getMatchupResult(c, p.card)));
    if (beaters.length === 1 && beaters[0] === myCard) uniqueMass += p.count;
  }
  const tot = bagTotal(oppFull);
  return Math.min(1, pWin + (tot > 0 ? 0.4 * (uniqueMass / tot) : 0));
}

function blackSituational(
  view: WinningStreakDummyView,
  oppCard: WSCardType,
  suitCandidates: WSCardType[],
): number {
  const streak = view.my.currentStreak;
  let m = 0;
  if (streak >= 2) m -= 1.65;
  if (breakWindow(view)) m -= 0.8;

  const canAfford =
    streak === 0
    || (streak === 1 && view.my.maxStreak > view.opp.maxStreak);
  const allSuitsLose =
    suitCandidates.length > 0
    && suitCandidates.every((c) => !isWinResult(getMatchupResult(c, oppCard)));
  const oppStrong = oppCard === 'colorJoker' || allSuitsLose;

  if (dumpWindow(view) && !breakWindow(view)) m += 0.18;
  if (canAfford && oppStrong) m += 1.1;
  else if (oppStrong && streak <= 1) m += 0.55;
  return m;
}

function tierKnobs(tier: DummyAiTier): {
  policyMix: number;
  bestRate: number;
  softTemp: number;
} {
  if (tier === '하') return { policyMix: 0.25, bestRate: 0.7, softTemp: 0.28 };
  if (tier === '중') return { policyMix: 0.6, bestRate: 0.9, softTemp: 0.14 };
  return { policyMix: 0.88, bestRate: 0.97, softTemp: 0.08 };
}

function scoreVsOpp(
  myCard: WSCardType,
  oppCard: WSCardType,
  view: WinningStreakDummyView,
  suitCandidates: WSCardType[],
  strength: number,
): number {
  const result = getMatchupResult(myCard, oppCard);
  const win = isWinResult(result);
  const streakAfter = win ? view.my.currentStreak + 1 : 0;
  const newMax = Math.max(view.my.maxStreak, streakAfter);
  const scale = matchupScale(view);

  let s = 0;
  if (win) {
    s += 1.0 * scale;
    s += streakAfter * 0.35 * (extendWindow(view) || breakWindow(view) ? 1 : 0.45);
    if (newMax > view.my.maxStreak) s += (0.8 + newMax * 0.15) * (extendWindow(view) ? 1 : 0.4);
    if (view.my.maxStreak === view.opp.maxStreak) s += 0.15;
  } else {
    s -= 0.55 * scale;
    if (view.my.currentStreak >= 2) s -= 0.35 * view.my.currentStreak;
    if (dumpWindow(view) && !breakWindow(view)) s += 0.5;
  }

  const oppResult = getMatchupResult(oppCard, myCard);
  if (isWinResult(oppResult)) {
    const oppStreakAfter = view.opp.currentStreak + 1;
    if (oppStreakAfter > view.opp.maxStreak) s -= 1.15;
    if (view.opp.currentStreak >= 2) s -= 0.4 * view.opp.currentStreak;
    if (breakWindow(view)) s -= 0.5;
  }

  if (myCard === 'colorJoker') s += colorSavePenalty(view, suitCandidates.length);
  if (myCard === 'blackJoker') s += blackSituational(view, oppCard, suitCandidates);

  // 약한 패를 털 타이밍 vs 강한 패를 쓸 타이밍
  if (dumpWindow(view) && !breakWindow(view)) {
    s += (0.45 - strength) * 0.7;
  } else if (breakWindow(view) || extendWindow(view)) {
    s += (strength - 0.4) * 0.75;
  } else {
    s += (0.4 - strength) * 0.35;
  }

  return s;
}

function pickFromScores(
  scored: Array<{ card: WSCardType; score: number }>,
  tier: DummyAiTier,
): WSCardType {
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const knobs = tierKnobs(tier);
  if (scored.length === 1 || Math.random() < knobs.bestRate) return best.card;

  const band = scored.filter((x) => x.score >= best.score - knobs.softTemp).slice(0, 4);
  return band[Math.floor(Math.random() * band.length)]!.card;
}

/**
 * 공개: 양측 잔여 장수·직전 카드·연승. 이번 라운드 상대 제출 금지.
 * 장수는 확정. 샘플은 “그 중에서 뭘 낼지”만.
 */
export async function pickWinningStreakActionAsync(
  view: WinningStreakDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<WinningStreakAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;
  if (view.phase !== 'cardSelect' || view.my.submitted) return null;

  const candidates = availableCards(view.my.remainingCards, view.my.lastPlayedCard);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    await runPsychologySearch(budgetMs, () => {});
    return { type: 'selectCard', card: candidates[0]! };
  }

  const legal = legalBag(view.opp.remainingCards, view.opp.lastPlayedCard);
  const full = fullBag(view.opp.remainingCards);
  const knobs = tierKnobs(tier);
  const suits = candidates.filter(isSuit);
  const acc = new Map<WSCardType, number>();
  const strength = new Map<WSCardType, number>();
  for (const c of candidates) {
    acc.set(c, 0);
    strength.set(c, cardStrength(c, view.my.remainingCards, full));
  }

  await runPsychologySearch(budgetMs, () => {
    const oppCard = sampleOppCard(legal, view, knobs.policyMix);
    if (!oppCard) {
      for (const c of candidates) {
        const st = strength.get(c) ?? 0.5;
        let s = dumpWindow(view) && !breakWindow(view) ? (0.45 - st) * 0.7 : (st - 0.45) * 0.2;
        if (c === 'colorJoker') s += colorSavePenalty(view, suits.length);
        acc.set(c, (acc.get(c) ?? 0) + s);
      }
      return;
    }
    for (const c of candidates) {
      acc.set(
        c,
        (acc.get(c) ?? 0) + scoreVsOpp(c, oppCard, view, suits, strength.get(c) ?? 0.5),
      );
    }
  });

  const scored = candidates.map((card) => ({ card, score: acc.get(card) ?? 0 }));
  const openingMix = view.round <= 2 && dumpWindow(view) && !breakWindow(view);
  if (openingMix) {
    const style = dummyStyle(dummyId);
    const card = pickWeighted(
      scored.map((x) => ({
        item: x.card,
        w: openingWeight(x.card, style) * Math.max(0.2, 1 + x.score * 0.05),
      })),
    );
    return { type: 'selectCard', card };
  }
  return { type: 'selectCard', card: pickFromScores(scored, tier) };
}
