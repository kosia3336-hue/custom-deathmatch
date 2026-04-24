import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { GS2CardId } from '@shared/types/grape-sugar-2.js';
import { AI_THINK_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { GS2InternalState, GS2PlayerInternal } from './types.js';
import { gameStates, trySubmit, resetTimeout } from './state.js';

function wait(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function randDelay(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

function getAI(s: GS2InternalState): GS2PlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}
function getUser(s: GS2InternalState): GS2PlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

/**
 * 카드별 효용 점수 산정 (간이 휴리스틱).
 * - context-aware: 점수 차, 잔여 라운드, 양측 보유 카드 등 고려.
 */
function scoreCard(
  card: GS2CardId,
  ai: GS2PlayerInternal,
  user: GS2PlayerInternal,
  state: GS2InternalState,
): number {
  const remainRounds = state.maxRound - state.round + 1;
  const scoreDiff = ai.score - user.score; // +면 AI 우세
  const sugarRatio = ai.sugarRemain / Math.max(1, user.sugarRemain);
  const userHasSpaceCrush = user.hand.includes('spaceCrush');
  const userHasNoAction = user.hand.includes('noAction');
  const userHasMinus3 = user.hand.includes('minus3');
  const userHasEarthCrush = user.hand.includes('earthCrush');

  let s = 0;
  switch (card) {
    case 'plus5':
      s = 4 + Math.random();
      if (sugarRatio < 0.7) s += 1.5;
      break;

    case 'copy':
      s = 3.5 + Math.random();
      if (ai.sugarRemain >= 6) s += 1.5;
      if (userHasSpaceCrush) s -= 1.2;
      break;

    case 'highRisk':
      s = 4 + Math.random();
      if (ai.sugarRemain >= 8) s += 1;
      if (scoreDiff < 0) s += 1.5; // 뒤지면 도박 가치 ↑
      if (userHasSpaceCrush) s -= 1.0;
      if (state.round >= state.maxRound) s += 1.0; // 마지막 라운드는 패널티 없음
      break;

    case 'grapeBless':
      s = 3 + Math.random();
      if (ai.sugarRemain >= user.sugarRemain) s += 1.5; // 우세 시 +2점 노림
      else s -= 1.0;
      if (userHasSpaceCrush) s -= 0.5;
      break;

    case 'dice':
      s = 2.5 + Math.random();
      if (scoreDiff <= -2) s += 1.0; // 변동성 카드, 뒤질 때 가치
      if (userHasSpaceCrush) s -= 1.0;
      break;

    case 'breath':
      s = 1.0 + Math.random();
      if (state.maxRound === 9) s = 0.1; // 이미 연장됨
      else if (scoreDiff <= -1 && remainRounds <= 2) s += 3.0; // 뒤지고 마무리 직전이면 가치 ↑
      else if (scoreDiff >= 2) s -= 1.5; // 우세하면 굳이 연장하지 않음
      break;

    case 'minus3':
      s = 3 + Math.random();
      if (userHasSpaceCrush) s -= 0.5; // spaceCrush 가능성
      if (user.sugarRemain >= 6) s += 1.0;
      break;

    case 'earthCrush':
      s = 4 + Math.random();
      if (user.hand.includes('copy') || user.hand.includes('highRisk') || user.hand.includes('plus5')) s += 1.5;
      if (userHasSpaceCrush) s -= 1.0;
      break;

    case 'spaceCrush':
      s = 3 + Math.random();
      if (userHasNoAction) s -= 4.0; // 반드시 회피
      if (user.hand.includes('copy') || user.hand.includes('highRisk') || user.hand.includes('grapeBless')) s += 2.5;
      if (state.round >= state.maxRound) s += 0.5;
      break;

    case 'noAction':
      s = 1.0 + Math.random();
      if (userHasSpaceCrush) s += 5.0; // 즉시 게임 승리 노림
      if (userHasMinus3) s += 0.3;
      if (userHasEarthCrush) s += 0.3;
      if (ai.sugarRemain <= 2) s -= 1.0;
      break;
  }
  return s;
}

function pickCard(s: GS2InternalState): GS2CardId {
  const ai = getAI(s);
  const user = getUser(s);
  if (ai.hand.length === 0) return 'noAction';
  if (ai.hand.length === 1) return ai.hand[0];

  const scored = ai.hand.map((c) => ({ c, w: Math.max(0.05, scoreCard(c, ai, user, s)) }));
  const total = scored.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const { c, w } of scored) {
    r -= w;
    if (r <= 0) return c;
  }
  return scored[scored.length - 1].c;
}

function pickSugar(card: GS2CardId, ai: GS2PlayerInternal, user: GS2PlayerInternal, s: GS2InternalState): number {
  const remain = ai.sugarRemain;
  if (remain <= 0) return 0;

  const remainRounds = Math.max(1, s.maxRound - s.round + 1);
  const baseAvg = Math.max(1, Math.floor(remain / remainRounds));

  switch (card) {
    case 'spaceCrush':
    case 'noAction':
      return Math.min(remain, Math.max(0, Math.floor(baseAvg * 0.3 + Math.random() * 2)));
    case 'copy':
      return Math.min(remain, Math.max(2, Math.floor(baseAvg * 1.4 + Math.random() * 3)));
    case 'highRisk':
      return Math.min(remain, Math.max(2, Math.floor(baseAvg * 1.8 + Math.random() * 4)));
    case 'plus5':
    case 'grapeBless':
    case 'dice':
      return Math.min(remain, Math.max(1, Math.floor(baseAvg * 1.1 + Math.random() * 3)));
    case 'minus3':
    case 'earthCrush':
      return Math.min(remain, Math.max(1, Math.floor(baseAvg * 0.7 + Math.random() * 2)));
    case 'breath':
      return Math.min(remain, Math.max(1, Math.floor(baseAvg * 0.8 + Math.random() * 2)));
    default:
      return Math.min(remain, baseAvg);
  }
}

export async function handleAiTurn(io: IO, s: GS2InternalState) {
  if (s.phase !== 'input') return;
  const ai = getAI(s);
  if (ai.submitted) return;

  const gen = s.aiGeneration;
  await wait(randDelay(AI_THINK_DELAY));

  if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'input') return;
  if (ai.submitted) return;

  const card = pickCard(s);
  const sugar = pickSugar(card, ai, getUser(s), s);
  resetTimeout(s, ai.id);
  trySubmit(io, s, ai.id, card, sugar);
}
