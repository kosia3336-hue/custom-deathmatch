import type {
  ChoiceHoldemCard,
  ChoiceHoldemEvaluation,
  ChoiceHoldemHandCategory,
} from '@shared/types/choice-holdem.js';

const CATEGORY_STRENGTH: Record<ChoiceHoldemHandCategory, number> = {
  'high-card': 0,
  'one-pair': 1,
  'two-pair': 2,
  triple: 3,
  straight: 4,
  'full-house': 5,
  'four-kind': 6,
};

function compareNumbers(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function evaluateChoiceHoldemHand(
  communityCards: ChoiceHoldemCard[],
  privateCards: ChoiceHoldemCard[],
): ChoiceHoldemEvaluation {
  const cards = [...communityCards, ...privateCards];
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  const groups = [...counts.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || rightValue - leftValue,
  );
  const quads = groups.filter(([, count]) => count === 4).map(([value]) => value);
  const triples = groups.filter(([, count]) => count === 3).map(([value]) => value);
  const pairs = groups.filter(([, count]) => count === 2).map(([value]) => value);
  const isStraight = [1, 2, 3, 4, 5].every((value) => counts.has(value));

  let category: ChoiceHoldemHandCategory = 'high-card';
  let primaryValues: number[] = [];
  let comboValues = new Set<number>();
  if (quads.length > 0) {
    category = 'four-kind';
    primaryValues = [quads[0]];
    comboValues = new Set(primaryValues);
  } else if (triples.length > 0 && pairs.length > 0) {
    category = 'full-house';
    primaryValues = [triples[0], pairs[0]];
    comboValues = new Set(primaryValues);
  } else if (isStraight) {
    category = 'straight';
    primaryValues = [5];
    comboValues = new Set([1, 2, 3, 4, 5]);
  } else if (triples.length > 0) {
    category = 'triple';
    primaryValues = [triples[0]];
    comboValues = new Set(primaryValues);
  } else if (pairs.length >= 2) {
    category = 'two-pair';
    primaryValues = pairs.slice(0, 2).sort((left, right) => right - left);
    comboValues = new Set(primaryValues);
  } else if (pairs.length === 1) {
    category = 'one-pair';
    primaryValues = [pairs[0]];
    comboValues = new Set(primaryValues);
  }

  return {
    category,
    primaryValues,
    privateKickers: privateCards
      .filter((card) => !comboValues.has(card))
      .sort((left, right) => right - left),
  };
}

export function compareChoiceHoldemEvaluations(
  left: ChoiceHoldemEvaluation,
  right: ChoiceHoldemEvaluation,
) {
  const categoryDifference = CATEGORY_STRENGTH[left.category] - CATEGORY_STRENGTH[right.category];
  if (categoryDifference !== 0) return Math.sign(categoryDifference);
  const primaryDifference = compareNumbers(left.primaryValues, right.primaryValues);
  if (primaryDifference !== 0) return primaryDifference;
  return compareNumbers(left.privateKickers, right.privateKickers);
}

export function choiceHoldemEvaluationScore(evaluation: ChoiceHoldemEvaluation) {
  const primary = evaluation.primaryValues.reduce(
    (score, value, index) => score + value / 10 ** (index + 1),
    0,
  );
  const kickers = evaluation.privateKickers.reduce(
    (score, value, index) => score + value / 10 ** (index + 3),
    0,
  );
  return CATEGORY_STRENGTH[evaluation.category] + primary + kickers;
}
