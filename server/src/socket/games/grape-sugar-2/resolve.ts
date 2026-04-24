import type {
  GS2PlayerAction, GS2ResolveStep, GS2Side, GS2CardId,
} from '@shared/types/grape-sugar-2.js';
import { GS2_HR_PENALTY } from '@shared/types/grape-sugar-2.js';
import type { GS2RoundResolveResult } from './types.js';

const SIDES: GS2Side[] = ['p1', 'p2'];

function other(side: GS2Side): GS2Side {
  return side === 'p1' ? 'p2' : 'p1';
}

export interface ResolveContext {
  /** 0~5 정수를 반환하는 난수기 (주사위) */
  rollDice: () => 1 | 2 | 3 | 4 | 5 | 6;
  /** 양측 breath 적용 가능 여부 (이미 한 번 적용됐으면 false) */
  breathAvailable: boolean;
  /** 마지막 라운드 여부 (true면 highRisk 패배 패널티 예약 없음) */
  isFinalRound: boolean;
}

const defaultRoll = (): 1 | 2 | 3 | 4 | 5 | 6 =>
  (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 한 라운드의 정산을 수행.
 * - 결과 sugar/score/페널티 예약 등을 모두 계산하여 ResolveStep 시퀀스로 반환.
 * - 외부(state.ts)는 이 결과를 바탕으로 실제 player 상태를 변경.
 */
export function resolveRound(
  actA: GS2PlayerAction,
  actB: GS2PlayerAction,
  ctx: Partial<ResolveContext> = {},
): GS2RoundResolveResult {
  const rollDice = ctx.rollDice ?? defaultRoll;
  const breathAvailable = ctx.breathAvailable ?? true;
  const isFinalRound = ctx.isFinalRound ?? false;

  const steps: GS2ResolveStep[] = [];
  const cards: Record<GS2Side, GS2CardId> = { p1: actA.card, p2: actB.card };

  steps.push({ type: 'reveal', actions: { p1: actA, p2: actB } });

  /* ───── 0a. 무행동 vs 우주뿌셔! → 즉시 게임 승리 ───── */
  if (cards.p1 === 'noAction' && cards.p2 === 'spaceCrush') {
    steps.push({ type: 'instantWin', winner: 'p1', reason: 'noActionVsSpaceCrush' });
    return makeInstantWinResult(steps, 'p1', actA, actB);
  }
  if (cards.p2 === 'noAction' && cards.p1 === 'spaceCrush') {
    steps.push({ type: 'instantWin', winner: 'p2', reason: 'noActionVsSpaceCrush' });
    return makeInstantWinResult(steps, 'p2', actA, actB);
  }

  /* ───── 0b. 우주뿌셔! vs 우주뿌셔! → 양측 무효, 무승부 라운드 ───── */
  if (cards.p1 === 'spaceCrush' && cards.p2 === 'spaceCrush') {
    steps.push({ type: 'cancel', targetSide: 'p1', bySide: 'p2' });
    steps.push({ type: 'cancel', targetSide: 'p2', bySide: 'p1' });
    steps.push({ type: 'final', roundSugar: { p1: 0, p2: 0 } });
    steps.push({ type: 'winner', winner: 'tie', scoreDelta: { p1: 0, p2: 0 } });
    return {
      steps,
      finalRoundSugar: { p1: 0, p2: 0 },
      winner: 'tie',
      scoreDelta: { p1: 0, p2: 0 },
      blessOutcome: { p1: null, p2: null },
      diceLoserBonusTo: null,
      hrPenaltyScheduled: { p1: 0, p2: 0 },
      breathExtended: false,
      instantWin: null,
    };
  }

  /* ───── 1. roundSugar 초기화 (제출 설탕 그대로) ───── */
  const round: Record<GS2Side, number> = { p1: actA.sugar, p2: actB.sugar };

  /* ───── 2. 우주뿌셔! 단방향 처리 ─────
   *   - 본인 우주뿌셔! → 상대 카드 효과 무효, 상대 round=0
   *   - 상대 우주뿌셔! → 본인 카드 효과 무효, 본인 round=0
   *   (둘 다 이 위에서 처리됨; 여기는 한쪽만 spaceCrush인 케이스)
   */
  const cardEffective: Record<GS2Side, boolean> = { p1: true, p2: true };
  for (const side of SIDES) {
    if (cards[side] === 'spaceCrush') {
      const opp = other(side);
      cardEffective[opp] = false;
      round[opp] = 0;
      steps.push({ type: 'cancel', targetSide: opp, bySide: side });
    }
  }

  /* ───── 3. 1순위 카드 적용 (effective인 카드만) ─────
   * 적용 카드: plus5, copy, highRisk, grapeBless, dice, breath
   * - grapeBless: 점수 보정은 라운드 종료 후
   * - dice: 굴려서 1·2 / 3·4 즉시 sugar 적용, 5·6 은 라운드 후 보정
   * - breath: maxRound 변경 (외부에서 처리), 여기서는 step만 남김
   */
  const blessActive: Record<GS2Side, boolean> = { p1: false, p2: false };
  let diceLoserBonusTo: GS2Side | null = null;
  let breathExtended = false;
  let breathConsumed = !breathAvailable;

  for (const side of SIDES) {
    if (!cardEffective[side]) continue;
    const card = cards[side];
    const opp = other(side);

    switch (card) {
      case 'plus5': {
        const before = round[side];
        round[side] = before + 5;
        steps.push({
          type: 'effect', actor: side, card, targetSide: side,
          before, after: round[side], op: '+5',
        });
        break;
      }
      case 'copy': {
        const before = round[side];
        round[side] = before * 2;
        steps.push({
          type: 'effect', actor: side, card, targetSide: side,
          before, after: round[side], op: '×2',
        });
        break;
      }
      case 'highRisk': {
        const before = round[side];
        round[side] = before * 3;
        steps.push({
          type: 'effect', actor: side, card, targetSide: side,
          before, after: round[side], op: '×3',
        });
        break;
      }
      case 'grapeBless': {
        blessActive[side] = true;
        steps.push({
          type: 'effect', actor: side, card, targetSide: side,
          before: round[side], after: round[side], op: '점수 보정 예약',
        });
        break;
      }
      case 'dice': {
        const roll = rollDice();
        if (roll === 1 || roll === 2) {
          const before = round[opp];
          round[opp] = before - 3;
          steps.push({ type: 'dice', actor: side, roll, branch: 'opp-3' });
          steps.push({
            type: 'effect', actor: side, card, targetSide: opp,
            before, after: round[opp], op: '주사위 상대 -3',
          });
        } else if (roll === 3 || roll === 4) {
          const before = round[side];
          round[side] = before - 5;
          steps.push({ type: 'dice', actor: side, roll, branch: 'self-5' });
          steps.push({
            type: 'effect', actor: side, card, targetSide: side,
            before, after: round[side], op: '주사위 본인 -5',
          });
        } else {
          steps.push({ type: 'dice', actor: side, roll, branch: 'loserBonus' });
          diceLoserBonusTo = side; // actor가 미승리 시 상대에게 +2점
        }
        break;
      }
      case 'breath': {
        if (!breathConsumed) {
          breathConsumed = true;
          breathExtended = true;
          steps.push({ type: 'breathExtended', nowMaxRound: 9 });
        } else {
          steps.push({ type: 'breathNoEffect', reason: 'alreadyExtended' });
        }
        break;
      }
      default:
        break;
    }
  }
  // 우주뿌셔!로 cancel된 breath 표시
  for (const side of SIDES) {
    if (cards[side] === 'breath' && !cardEffective[side]) {
      steps.push({ type: 'breathNoEffect', reason: 'cancelled' });
    }
  }

  /* ───── 4. 2순위 페널티 카드 적용 (-3, 지구뿌셔!) ─────
   * 우선순위가 같은 두 페널티가 동시에 들어오면 표 순서대로(-3 먼저, earthCrush 다음)
   * 단, 한쪽이 페널티 카드를 효과 무효화 당했으면 적용하지 않음
   */
  for (const side of SIDES) {
    if (!cardEffective[side]) continue;
    if (cards[side] !== 'minus3') continue;
    const opp = other(side);
    const before = round[opp];
    round[opp] = before - 3;
    steps.push({
      type: 'effect', actor: side, card: 'minus3', targetSide: opp,
      before, after: round[opp], op: '상대 -3',
    });
  }
  for (const side of SIDES) {
    if (!cardEffective[side]) continue;
    if (cards[side] !== 'earthCrush') continue;
    const opp = other(side);
    const before = round[opp];
    round[opp] = Math.ceil(before / 2);
    steps.push({
      type: 'effect', actor: side, card: 'earthCrush', targetSide: opp,
      before, after: round[opp], op: '상대 ÷2 (올림)',
    });
  }

  /* ───── 5. 하한 + 반올림(올림): 라운드 종료 시 1회 ───── */
  for (const side of SIDES) {
    round[side] = Math.ceil(Math.max(0, round[side]));
  }
  steps.push({ type: 'final', roundSugar: { p1: round.p1, p2: round.p2 } });

  /* ───── 6. 라운드 승자 판정 ───── */
  let winner: GS2Side | 'tie';
  if (round.p1 > round.p2) winner = 'p1';
  else if (round.p2 > round.p1) winner = 'p2';
  else winner = 'tie';

  const scoreDelta: Record<GS2Side, number> = { p1: 0, p2: 0 };
  if (winner !== 'tie') {
    scoreDelta[winner] += 1;
  }
  steps.push({
    type: 'winner',
    winner,
    scoreDelta: { p1: scoreDelta.p1, p2: scoreDelta.p2 },
  });

  /* ───── 7. 포도의가호 보정 ───── */
  const blessOutcome: Record<GS2Side, 'win' | 'loss' | 'tie' | null> = { p1: null, p2: null };
  for (const side of SIDES) {
    if (!blessActive[side]) continue;
    if (winner === side) {
      scoreDelta[side] += 2;
      blessOutcome[side] = 'win';
      steps.push({ type: 'bless', actor: side, outcome: 'win', scoreDelta: 2 });
    } else if (winner === 'tie') {
      blessOutcome[side] = 'tie';
      steps.push({ type: 'bless', actor: side, outcome: 'tie', scoreDelta: 0 });
    } else {
      scoreDelta[side] += -1;
      blessOutcome[side] = 'loss';
      steps.push({ type: 'bless', actor: side, outcome: 'loss', scoreDelta: -1 });
    }
  }

  /* ───── 8. 주사위 5·6 보너스: actor가 미승리(패배 or tie)이면 상대 +2점 ───── */
  if (diceLoserBonusTo) {
    const actor = diceLoserBonusTo;
    if (winner !== actor) {
      const beneficiary = other(actor);
      scoreDelta[beneficiary] += 2;
      steps.push({
        type: 'diceScore', actor, loserBonusTo: beneficiary, amount: 2,
      });
    }
  }

  /* ───── 9. 하이리스크 패배 패널티 예약 (다음 라운드 시작 시 적용) ─────
   * - actor가 패배(loss)일 때만 적용. tie면 예약 없음.
   * - 마지막 라운드는 적용하지 않음 (다음 라운드가 없음).
   * - 실제 차감액은 actor의 sugarRemain 이전이며, 외부에서 결정. 여기서는 예약 사실만.
   */
  const hrPenaltyScheduled: Record<GS2Side, number> = { p1: 0, p2: 0 };
  if (!isFinalRound) {
    for (const side of SIDES) {
      if (!cardEffective[side]) continue;
      if (cards[side] !== 'highRisk') continue;
      if (winner === side) continue;
      if (winner === 'tie') continue;
      hrPenaltyScheduled[side] = GS2_HR_PENALTY;
      steps.push({
        type: 'hrPenaltyScheduled',
        actor: side,
        amount: GS2_HR_PENALTY,
      });
    }
  }

  return {
    steps,
    finalRoundSugar: { p1: round.p1, p2: round.p2 },
    winner,
    scoreDelta: { p1: scoreDelta.p1, p2: scoreDelta.p2 },
    blessOutcome,
    diceLoserBonusTo,
    hrPenaltyScheduled,
    breathExtended,
    instantWin: null,
  };
}

function makeInstantWinResult(
  steps: GS2ResolveStep[],
  winner: GS2Side,
  _actA: GS2PlayerAction,
  _actB: GS2PlayerAction,
): GS2RoundResolveResult {
  return {
    steps,
    finalRoundSugar: { p1: 0, p2: 0 },
    winner,
    scoreDelta: { p1: 0, p2: 0 },
    blessOutcome: { p1: null, p2: null },
    diceLoserBonusTo: null,
    hrPenaltyScheduled: { p1: 0, p2: 0 },
    breathExtended: false,
    instantWin: winner,
  };
}
