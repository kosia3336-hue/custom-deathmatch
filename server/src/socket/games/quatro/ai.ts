/**
 * 콰트로 COM(AI) — 멀리건/오픈/교환/스탑 결정.
 *
 * 손패 평가: 콰트로(문양·숫자 모두 비중복, 검정0 만능) 여부 > 비중복 카드 수 > 합계.
 * 교환은 서버가 VP 선택 규칙(vpPickCard)을 알고 있으므로 결과를 시뮬레이션해
 * 가장 이득이 큰 (VP, 내놓을 카드) 조합을 고른다.
 */
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { QUATRO_VP_COUNT, type QuatroCard } from '@shared/types/quatro.js';
import type { IO } from '../../types.js';
import {
  gameStates,
  isQuatro,
  vpPickCard,
  isLastExchangePhase,
  type QuatroState,
} from './state.js';

const AI_DELAY_MS = 1100;

/** 손패 점수: 콰트로 완성 여부(대) > 비중복 세트 크기(중) > 합계(소) */
function scoreHand(hand: QuatroCard[]): number {
  const normal = hand.filter((c) => c.suit !== 'black');
  const suits = new Set(normal.map((c) => c.suit));
  const nums = new Set(normal.map((c) => c.num));
  const distinct = Math.min(suits.size, nums.size) + (hand.length - normal.length);
  const quatro = isQuatro(hand) ? 1 : 0;
  const sum = hand.reduce((a, c) => a + c.num, 0);
  return quatro * 10000 + distinct * 100 + sum;
}

/** 중복(문양 또는 숫자)에 걸리는 카드 중 가장 낮은 것 — 버릴 후보 */
function worstCard(hand: QuatroCard[], openIds: Set<string>): QuatroCard | null {
  const closed = hand.filter((c) => !openIds.has(c.id));
  if (closed.length === 0) return null;
  // 각 카드를 뺐을 때 남은 3장의 점수가 가장 높은 카드 = 가장 불필요한 카드
  let best: { card: QuatroCard; score: number } | null = null;
  for (const c of closed) {
    const rest = hand.filter((x) => x.id !== c.id);
    const s = scoreHand(rest) * 10 - c.num; // 낮은 숫자를 우선 버림
    if (!best || s > best.score) best = { card: c, score: s };
  }
  return best?.card ?? null;
}

interface ExchangePlan {
  vpIdx: number;
  give: QuatroCard;
  gain: number;
}

/** 미사용 VP 전부에 대해 (버릴 카드 → 받을 카드) 시뮬레이션, 최고 이득 플랜 */
function bestExchange(s: QuatroState, aiIdx: number): ExchangePlan | null {
  const p = s.players[aiIdx];
  const closed = p.hand.filter((c) => !p.openIds.has(c.id));
  if (closed.length === 0) return null;

  const base = scoreHand(p.hand);
  let best: ExchangePlan | null = null;
  for (let vpIdx = 0; vpIdx < QUATRO_VP_COUNT; vpIdx++) {
    if (p.usedVps.has(vpIdx)) continue;
    const vp = s.vps[vpIdx];
    if (!vp) continue;
    const receive = vpPickCard(s, vpIdx, aiIdx);
    for (const give of closed) {
      const nextHand = [...p.hand.filter((c) => c.id !== give.id), receive];
      const gain = scoreHand(nextHand) - base;
      if (!best || gain > best.gain) best = { vpIdx, give, gain };
    }
  }
  return best;
}

function aiIdxOf(s: QuatroState): number {
  return s.players.findIndex((p) => p.id === AI_PLAYER_ID);
}

/**
 * 현재 상태에서 AI가 행동할 차례면 예약 실행.
 * advance() 이후에 호출된다. handleAction 스타일로 상태를 직접 조작하지 않고
 * index.ts 가 노출하는 액션 적용 콜백을 사용한다.
 */
export function maybeScheduleAi(
  io: IO,
  s: QuatroState,
  apply: (io: IO, s: QuatroState, playerIdx: number, action:
    | { type: 'mulligan'; use: boolean }
    | { type: 'open'; cardId: string }
    | { type: 'exchange'; vpIndex: number; giveCardId: string }
    | { type: 'stop' },
  ) => void,
  currentMulliganIdx: (s: QuatroState) => number,
  currentExchangeIdx: (s: QuatroState) => number,
) {
  if (s.playMode !== 'com' || s.gameOver) return;
  const aiIdx = aiIdxOf(s);
  if (aiIdx === -1) return;
  const ai = s.players[aiIdx];

  let action:
    | { type: 'mulligan'; use: boolean }
    | { type: 'open'; cardId: string }
    | { type: 'exchange'; vpIndex: number; giveCardId: string }
    | { type: 'stop' }
    | null = null;

  if (s.phase === 'mulligan') {
    if (currentMulliganIdx(s) !== aiIdx) return;
    // 비중복 세트가 3 미만이면 멀리건
    const normal = ai.hand.filter((c) => c.suit !== 'black');
    const distinct =
      Math.min(new Set(normal.map((c) => c.suit)).size, new Set(normal.map((c) => c.num)).size) +
      (ai.hand.length - normal.length);
    action = { type: 'mulligan', use: distinct < 3 && ai.mulligansUsed < 2 };
  } else if (s.phase === 'open') {
    if (ai.openChoice) return;
    // 버릴 후보(가장 불필요한 카드)를 오픈 — 정보 노출 최소화 겸 교환 미끼
    const w = worstCard(ai.hand, ai.openIds);
    if (!w) return;
    action = { type: 'open', cardId: w.id };
  } else if (s.phase === 'exchange') {
    if (currentExchangeIdx(s) !== aiIdx) return;
    const plan = bestExchange(s, aiIdx);
    const remaining = QUATRO_VP_COUNT - ai.usedVps.size;
    const must = isLastExchangePhase(s) && remaining > 0;
    // 이득이 있으면 교환. 이득이 없어도 마지막 페이즈거나 남은 의무가 많으면 손해 최소 교환.
    if (plan && (plan.gain > 0 || must || remaining >= 4)) {
      action = { type: 'exchange', vpIndex: plan.vpIdx, giveCardId: plan.give.id };
    } else {
      action = { type: 'stop' };
    }
  }

  if (!action) return;
  const roomId = s.roomId;
  const phaseAt = s.phase;
  const roundAt = s.round;
  setTimeout(() => {
    const cur = gameStates.get(roomId);
    if (!cur || cur.gameOver) return;
    if (cur.phase !== phaseAt || cur.round !== roundAt) return; // 상태가 바뀌었으면 폐기 (재계산됨)
    apply(io, cur, aiIdxOf(cur), action!);
  }, AI_DELAY_MS);
}
