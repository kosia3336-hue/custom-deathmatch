import type {
  GS2CardId,
  GS2PlayerAction,
  GS2ResolveStep,
  GS2Side,
} from './grape-sugar-2';
import { GS2_HR_PENALTY } from './grape-sugar-2';

const SIDES: GS2Side[] = ['p1', 'p2'];

function other(side: GS2Side): GS2Side {
  return side === 'p1' ? 'p2' : 'p1';
}

export interface GS2ResolveContext {
  /** 0~5 정수를 반환하는 난수기 (주사위) */
  rollDice: () => 1 | 2 | 3 | 4 | 5 | 6;
  /** 양측 breath 적용 가능 여부 (이미 한 번 적용됐으면 false) */
  breathAvailable: boolean;
  /** 마지막 라운드 여부 (true면 highRisk 패배 패널티 예약 없음) */
  isFinalRound: boolean;
}

export interface GS2RoundResolveResult {
  steps: GS2ResolveStep[];
  finalRoundSugar: { p1: number; p2: number };
  winner: GS2Side | 'tie';
  scoreDelta: { p1: number; p2: number };
  blessOutcome: { p1: 'win' | 'loss' | 'tie' | null; p2: 'win' | 'loss' | 'tie' | null };
  diceLoserBonusTo: GS2Side | null;
  hrPenaltyScheduled: { p1: number; p2: number };
  breathExtended: boolean;
  instantWin: GS2Side | null;
}

const defaultRoll = (): 1 | 2 | 3 | 4 | 5 | 6 =>
  (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 한 라운드 정산. 소켓 엔진·자문 스냅샷이 같은 함수를 쓴다.
 */
export function resolveRound(
  actA: GS2PlayerAction,
  actB: GS2PlayerAction,
  ctx: Partial<GS2ResolveContext> = {},
): GS2RoundResolveResult {
  const rollDice = ctx.rollDice ?? defaultRoll;
  const breathAvailable = ctx.breathAvailable ?? true;
  const isFinalRound = ctx.isFinalRound ?? false;

  const steps: GS2ResolveStep[] = [];
  const cards: Record<GS2Side, GS2CardId> = { p1: actA.card, p2: actB.card };

  steps.push({ type: 'reveal', actions: { p1: actA, p2: actB } });

  if (cards.p1 === 'noAction' && cards.p2 === 'spaceCrush') {
    steps.push({ type: 'instantWin', winner: 'p1', reason: 'noActionVsSpaceCrush' });
    return makeInstantWinResult(steps, 'p1');
  }
  if (cards.p2 === 'noAction' && cards.p1 === 'spaceCrush') {
    steps.push({ type: 'instantWin', winner: 'p2', reason: 'noActionVsSpaceCrush' });
    return makeInstantWinResult(steps, 'p2');
  }

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

  const round: Record<GS2Side, number> = { p1: actA.sugar, p2: actB.sugar };

  const cardEffective: Record<GS2Side, boolean> = { p1: true, p2: true };
  for (const side of SIDES) {
    if (cards[side] === 'spaceCrush') {
      const opp = other(side);
      cardEffective[opp] = false;
      round[opp] = 0;
      steps.push({ type: 'cancel', targetSide: opp, bySide: side });
    }
  }

  const blessActive: Record<GS2Side, boolean> = { p1: false, p2: false };
  let diceLoserBonusTo: GS2Side | null = null;
  let breathExtended = false;
  let breathConsumed = !breathAvailable;

  for (const side of SIDES) {
    if (!cardEffective[side]) continue;
    const card = cards[side];

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
      case 'breath': {
        if (!breathConsumed) {
          breathConsumed = true;
          breathExtended = true;
          steps.push({ type: 'breathExtended', nowMaxRound: 9 });
        } else {
          steps.push({ type: 'breathNoEffect', actor: side, reason: 'alreadyExtended' });
        }
        break;
      }
      default:
        break;
    }
  }

  for (const side of SIDES) {
    if (!cardEffective[side]) continue;
    if (cards[side] !== 'dice') continue;
    const opp = other(side);
    const roll = rollDice();
    if (roll === 1 || roll === 2) {
      const before = round[opp];
      round[opp] = before - 3;
      steps.push({ type: 'dice', actor: side, roll, branch: 'opp-3' });
      steps.push({
        type: 'effect', actor: side, card: 'dice', targetSide: opp,
        before, after: round[opp], op: '주사위 상대 -3',
      });
    } else if (roll === 3 || roll === 4) {
      const before = round[side];
      round[side] = before - 5;
      steps.push({ type: 'dice', actor: side, roll, branch: 'self-5' });
      steps.push({
        type: 'effect', actor: side, card: 'dice', targetSide: side,
        before, after: round[side], op: '주사위 본인 -5',
      });
    } else {
      steps.push({ type: 'dice', actor: side, roll, branch: 'loserBonus' });
      diceLoserBonusTo = side;
    }
  }
  for (const side of SIDES) {
    if (cards[side] === 'breath' && !cardEffective[side]) {
      steps.push({ type: 'breathNoEffect', actor: side, reason: 'cancelled' });
    }
  }

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

  for (const side of SIDES) {
    round[side] = Math.ceil(Math.max(0, round[side]));
  }
  steps.push({ type: 'final', roundSugar: { p1: round.p1, p2: round.p2 } });

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

  const blessOutcome: Record<GS2Side, 'win' | 'loss' | 'tie' | null> = { p1: null, p2: null };
  for (const side of SIDES) {
    if (!blessActive[side]) continue;
    if (winner === side) {
      scoreDelta[side] += 1;
      blessOutcome[side] = 'win';
      steps.push({ type: 'bless', actor: side, outcome: 'win', scoreDelta: 1 });
    } else if (winner === 'tie') {
      blessOutcome[side] = 'tie';
      steps.push({ type: 'bless', actor: side, outcome: 'tie', scoreDelta: 0 });
    } else {
      scoreDelta[side] += -1;
      blessOutcome[side] = 'loss';
      steps.push({ type: 'bless', actor: side, outcome: 'loss', scoreDelta: -1 });
    }
  }

  if (diceLoserBonusTo) {
    const actor = diceLoserBonusTo;
    if (winner !== actor) {
      const beneficiary = other(actor);
      const amount = winner === 'tie' ? 2 : 1;
      scoreDelta[beneficiary] += amount;
      steps.push({
        type: 'diceScore', actor, loserBonusTo: beneficiary, amount,
      });
    }
  }

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
