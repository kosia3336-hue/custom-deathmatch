import type {
  SeedSeotdaCard,
  SeedSeotdaEvaluation,
  SeedSeotdaRoundReason,
} from '@shared/types/seed-seotda.js';

type Comparison = -1 | 0 | 1;

function orderedMonths(cards: SeedSeotdaCard[]) {
  return cards.map((card) => card.month).sort((left, right) => left - right);
}

function hasMonths(months: number[], left: number, right: number) {
  return months[0] === left && months[1] === right;
}

function evaluation(
  kind: SeedSeotdaEvaluation['kind'],
  name: string,
  strength: number,
  pairMonth: SeedSeotdaEvaluation['pairMonth'] = null,
  point: number | null = null,
): SeedSeotdaEvaluation {
  return { kind, name, strength, pairMonth, point };
}

export function evaluateSeedSeotdaHand(cards: SeedSeotdaCard[]): SeedSeotdaEvaluation {
  if (cards.length !== 2) throw new Error('시드섯다 족보는 카드 두 장으로 판정합니다.');
  const months = orderedMonths(cards);
  const bothBright = cards.every((card) => card.kind === 'bright');
  const bothAnimal = cards.every((card) => card.kind === 'animal');

  if (bothBright && hasMonths(months, 3, 8)) {
    return evaluation('38-gwang-ddaeng', '삼팔광땡', 400);
  }
  if (bothBright && (hasMonths(months, 1, 3) || hasMonths(months, 1, 8))) {
    return evaluation('gwang-ddaeng', hasMonths(months, 1, 3) ? '일삼광땡' : '일팔광땡', 390);
  }
  if (bothAnimal && hasMonths(months, 4, 7)) {
    return evaluation('amhaeng-eosa', '암행어사', 201, null, 1);
  }
  if (
    hasMonths(months, 3, 7) &&
    cards.some((card) => card.month === 3 && card.kind === 'bright') &&
    cards.some((card) => card.month === 7 && card.kind === 'animal')
  ) {
    return evaluation('ddaeng-jabi', '땡잡이', 200, null, 0);
  }
  if (bothAnimal && hasMonths(months, 4, 9)) {
    return evaluation('mung-gusa', '멍텅구리 구사', 0);
  }
  if (hasMonths(months, 4, 9)) {
    return evaluation('gusa', '구사', 0);
  }
  if (months[0] === months[1]) {
    const month = months[0];
    return evaluation(
      'ddaeng',
      month === 10 ? '장땡' : month === 1 ? '삥땡' : `${month}땡`,
      300 + month,
      month,
    );
  }

  const namedHands: Array<[number, number, SeedSeotdaEvaluation['kind'], string, number]> = [
    [1, 2, 'ali', '알리', 290],
    [1, 4, 'doksa', '독사', 280],
    [1, 9, 'guping', '구삥', 270],
    [1, 10, 'jangping', '장삥', 260],
    [4, 10, 'jangsa', '장사', 250],
    [4, 6, 'seryuk', '세륙', 240],
  ];
  const named = namedHands.find(([left, right]) => hasMonths(months, left, right));
  if (named) return evaluation(named[2], named[3], named[4]);

  const point = (months[0] + months[1]) % 10;
  if (point === 9) return evaluation('gapoh', '갑오', 220, null, 9);
  if (point === 0) return evaluation('mangtong', '망통', 200, null, 0);
  return evaluation('kkeut', `${point}끗`, 200 + point, null, point);
}

function isGwangDdaeng(hand: SeedSeotdaEvaluation) {
  return hand.kind === '38-gwang-ddaeng' || hand.kind === 'gwang-ddaeng';
}

function beatsGusaRematch(hand: SeedSeotdaEvaluation) {
  return isGwangDdaeng(hand) || hand.kind === 'ddaeng';
}

function beatsMungGusaRematch(hand: SeedSeotdaEvaluation) {
  return isGwangDdaeng(hand);
}

function contextualComparison(left: SeedSeotdaEvaluation, right: SeedSeotdaEvaluation): Comparison {
  if (left.kind === '38-gwang-ddaeng' || right.kind === '38-gwang-ddaeng') {
    return Math.sign(left.strength - right.strength) as Comparison;
  }
  if (left.kind === 'amhaeng-eosa' && right.kind === 'gwang-ddaeng') return 1;
  if (right.kind === 'amhaeng-eosa' && left.kind === 'gwang-ddaeng') return -1;
  if (left.kind === 'ddaeng-jabi' && right.kind === 'ddaeng' && (right.pairMonth ?? 10) <= 9) {
    return 1;
  }
  if (right.kind === 'ddaeng-jabi' && left.kind === 'ddaeng' && (left.pairMonth ?? 10) <= 9) {
    return -1;
  }
  return Math.sign(left.strength - right.strength) as Comparison;
}

export function compareSeedSeotdaHands(
  left: SeedSeotdaEvaluation,
  right: SeedSeotdaEvaluation,
): { comparison: Comparison; reason: Exclude<SeedSeotdaRoundReason, 'die'> } {
  const mungRematch =
    (left.kind === 'mung-gusa' && !beatsMungGusaRematch(right)) ||
    (right.kind === 'mung-gusa' && !beatsMungGusaRematch(left));
  if (mungRematch) return { comparison: 0, reason: 'mung-gusa-rematch' };

  const gusaRematch =
    (left.kind === 'gusa' && !beatsGusaRematch(right)) ||
    (right.kind === 'gusa' && !beatsGusaRematch(left));
  if (gusaRematch) return { comparison: 0, reason: 'gusa-rematch' };

  const comparison = contextualComparison(left, right);
  return { comparison, reason: comparison === 0 ? 'tie' : 'showdown' };
}

export function seedSeotdaEvaluationScore(hand: SeedSeotdaEvaluation) {
  if (hand.kind === 'mung-gusa') return 365;
  if (hand.kind === 'gusa') return 285;
  if (hand.kind === 'amhaeng-eosa') return 330;
  if (hand.kind === 'ddaeng-jabi') return 300;
  return hand.strength;
}
