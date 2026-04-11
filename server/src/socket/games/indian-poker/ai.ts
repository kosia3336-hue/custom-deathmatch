import type { IPHand, IPBettingAction } from '@shared/types/indian-poker.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { AI_DELAY_MS } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, IPPlayerInternal } from './types.js';
import { evaluateHand, judgeShowdown, getDiePenalty } from './judge.js';
import { getRemainingCards } from './deck.js';
import { gameStates, processBettingAction, broadcastState } from './state.js';

/* ── types ──────────────────────────────────────────── */

interface WinProbability { win: number; lose: number; draw: number; }
interface HandProbability { noPair: number; double: number; straight: number; triple: number; }
type BettingAction = { type: 'check' } | { type: 'call' } | { type: 'raise'; amount: number } | { type: 'die' };

/* ── helpers ────────────────────────────────────────── */

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY_MS.min + Math.random() * (AI_DELAY_MS.max - AI_DELAY_MS.min);
}

function getOpponent(s: InternalState, aiId: string): IPPlayerInternal {
  return aiId === s.player1Id ? s.players[s.player2Id] : s.players[s.player1Id];
}

function canCheck(s: InternalState): boolean {
  return !s.bettingStarted && s.currentTurnId === s.firstBettorId;
}

/* ── 승률 / 족보 확률 계산 ──────────────────────────── */

function calcWinProbability(
  communityCards: [number, number],
  userCard: number,
  usedCards: number[],
): WinProbability {
  const userHand = evaluateHand(userCard, communityCards);
  const remaining = getRemainingCards(usedCards, communityCards, userCard);

  let wins = 0, losses = 0, draws = 0;
  for (const aiCard of remaining) {
    const aiHand = evaluateHand(aiCard, communityCards);
    const result = judgeShowdown(
      { id: 'ai', card: aiCard, hand: aiHand },
      { id: 'user', card: userCard, hand: userHand },
    );
    if (result.isDraw) draws++;
    else if (result.winnerId === 'ai') wins++;
    else losses++;
  }

  const total = remaining.length || 1;
  return { win: wins / total, lose: losses / total, draw: draws / total };
}

function calcHandProbability(
  communityCards: [number, number],
  usedCards: number[],
  userCard: number,
): HandProbability {
  const remaining = getRemainingCards(usedCards, communityCards, userCard);
  const counts = { noPair: 0, double: 0, straight: 0, triple: 0 };
  for (const c of remaining) {
    counts[evaluateHand(c, communityCards)]++;
  }
  const total = remaining.length || 1;
  return {
    noPair: counts.noPair / total,
    double: counts.double / total,
    straight: counts.straight / total,
    triple: counts.triple / total,
  };
}

/* ── 컨텍스트 분석 ──────────────────────────────────── */

function calcUserAggressiveness(
  roundHistory: InternalState['roundHistory'],
  userId: string,
): number {
  if (roundHistory.length === 0) return 0.5;
  let raisedRounds = 0;
  let diedRounds = 0;
  for (const round of roundHistory) {
    const userActions = round.bettingActions.filter((a) => a.playerId === userId);
    if (userActions.some((a) => a.action === 'raise')) raisedRounds++;
    if (userActions.some((a) => a.action === 'die')) diedRounds++;
  }
  const total = roundHistory.length;
  const score = (raisedRounds / total) - (diedRounds / total) * 0.5 + 0.5;
  return Math.min(1, Math.max(0, score));
}

function calcGameStage(s: InternalState, aiId: string): number {
  const aiChips = s.players[aiId].chips;
  if (aiChips <= 0) return 1;
  return Math.min(1, (s.ante / aiChips) * 5);
}

function calcBluffFrequency(
  winProb: WinProbability,
  userAggressiveness: number,
  gameStage: number,
): number {
  let freq = 0.25;
  freq += (1 - userAggressiveness) * 0.15;
  freq -= gameStage * 0.12;
  freq *= 1 - winProb.lose * 0.4;
  return Math.min(0.45, Math.max(0.05, freq));
}

/* ── 다이 EV 비교 ───────────────────────────────────── */

function calcExpectedPenalty(handProb: HandProbability, aiChips: number): number {
  const rawPenalty = handProb.double * 5 + (handProb.straight + handProb.triple) * 10;
  return Math.min(rawPenalty, aiChips);
}

function calcCallEV(winProb: WinProbability, pot: number, callCost: number): number {
  return winProb.win * pot + winProb.draw * (pot / 2 - callCost) - winProb.lose * callCost;
}

function isCallBetterThanDie(
  winProb: WinProbability,
  handProb: HandProbability,
  pot: number,
  callCost: number,
  aiChips: number,
): boolean {
  return calcCallEV(winProb, pot, callCost) >= -calcExpectedPenalty(handProb, aiChips);
}

/* ── 레이즈 헬퍼 ───────────────────────────────────── */

/** AI 레이즈 가능 최대치: 자신의 올인 상한과 상대 올인 상한 중 작은 값 */
function aiMaxRaise(ai: IPPlayerInternal, opponent: IPPlayerInternal): number {
  const myMax = ai.roundBet + ai.chips;           // 내 올인 총 roundBet
  const opponentMax = opponent.roundBet + opponent.chips; // 상대 올인 총 roundBet
  return Math.min(myMax, opponentMax);
}

function valueRaise(s: InternalState, ai: IPPlayerInternal, winProb: WinProbability): BettingAction {
  const opponent = getOpponent(s, ai.id);
  const maxAmount = aiMaxRaise(ai, opponent);
  const minAmount = opponent.roundBet + 1;

  // 레이즈 자체가 불가능하면 call/die 로 폴백
  if (minAmount > maxAmount) return { type: 'call' };

  let raiseAmount: number;
  if (winProb.win >= 0.9) {
    raiseAmount = Math.min(opponent.roundBet + Math.ceil(s.pot * 0.8), maxAmount);
  } else if (winProb.win >= 0.8) {
    raiseAmount = Math.min(opponent.roundBet + Math.ceil(s.pot * 0.5), maxAmount);
  } else {
    raiseAmount = Math.min(opponent.roundBet + Math.ceil(s.pot * 0.3), maxAmount);
  }
  raiseAmount = Math.max(raiseAmount, minAmount); // 최소 조건 충족 (maxAmount 이하임이 보장됨)
  return { type: 'raise', amount: raiseAmount };
}

function bluffRaise(s: InternalState, ai: IPPlayerInternal): BettingAction {
  const opponent = getOpponent(s, ai.id);
  const maxAmount = aiMaxRaise(ai, opponent);
  const minAmount = opponent.roundBet + 1;

  if (minAmount > maxAmount) return { type: 'call' };

  const bluffAmount = Math.min(minAmount + Math.floor(Math.random() * 3), maxAmount);
  return { type: 'raise', amount: bluffAmount };
}

/* ── 최종 액션 결정 ─────────────────────────────────── */

function decideAction(s: InternalState): BettingAction {
  const userId = s.player1Id;
  const aiId = s.player2Id;
  const communityCards = s.communityCards!;
  const userCard = s.players[userId].card!;
  const ai = s.players[aiId];
  const user = s.players[userId];

  const winProb = calcWinProbability(communityCards, userCard, s.usedCards);
  const handProb = calcHandProbability(communityCards, s.usedCards, userCard);

  const userAggressiveness = calcUserAggressiveness(s.roundHistory, userId);
  const gameStage = calcGameStage(s, aiId);
  const bluffFreq = calcBluffFrequency(winProb, userAggressiveness, gameStage);

  const callCost = user.roundBet - ai.roundBet;
  const potAfterCall = s.pot + callCost;
  const potOdds = callCost > 0 ? callCost / potAfterCall : 0;
  const valueRaiseThreshold = 0.65 + gameStage * 0.1;

  // 1. 강한 우위 → 가치 레이즈
  if (winProb.win >= valueRaiseThreshold) {
    return valueRaise(s, ai, winProb);
  }

  // 2. 체크 가능한 선 베팅 상황
  if (canCheck(s)) {
    if (winProb.win >= 0.55) return valueRaise(s, ai, winProb);
    if (Math.random() < bluffFreq) return bluffRaise(s, ai);
    return { type: 'check' };
  }

  // 3. 상대가 레이즈한 상황
  const callIsBetter = isCallBetterThanDie(winProb, handProb, s.pot, callCost, ai.chips);

  if (winProb.win >= 0.4 && winProb.win > potOdds) {
    if (winProb.win >= 0.55 && Math.random() < 0.35) return valueRaise(s, ai, winProb);
    return { type: 'call' };
  }

  if (callIsBetter && callCost <= ai.chips) {
    return { type: 'call' };
  }

  if (Math.random() < bluffFreq) return bluffRaise(s, ai);

  return { type: 'die' };
}

/* ── 공개 API ───────────────────────────────────────── */

export async function aiTakeTurn(io: IO, s: InternalState): Promise<void> {
  if (s.phase !== 'betting') return;
  if (s.currentTurnId !== s.player2Id) return;

  const gen = s.aiGeneration;
  const action = decideAction(s);

  await wait(randDelay());

  if (!gameStates.has(s.roomId)) return;
  if (s.aiGeneration !== gen) return;
  if (s.phase !== 'betting') return;

  processBettingAction(io, s, s.player2Id, action);
}
