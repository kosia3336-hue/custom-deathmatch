import { describe, expect, it } from 'vitest';
import type { ChoiceHoldemCard } from '@shared/types/choice-holdem.js';
import {
  compareChoiceHoldemEvaluations,
  evaluateChoiceHoldemHand,
} from '../socket/games/choice-holdem/judge.js';

const cards = (...values: number[]) => values as ChoiceHoldemCard[];

describe('초이스 홀덤 족보 판정', () => {
  it('포 카드부터 원 페어까지 규칙 순서대로 분류한다', () => {
    expect(evaluateChoiceHoldemHand(cards(2, 2, 3), cards(2, 2))).toMatchObject({
      category: 'four-kind',
      primaryValues: [2],
    });
    expect(evaluateChoiceHoldemHand(cards(4, 4, 3), cards(4, 3))).toMatchObject({
      category: 'full-house',
      primaryValues: [4, 3],
    });
    expect(evaluateChoiceHoldemHand(cards(1, 2, 3), cards(4, 5))).toMatchObject({
      category: 'straight',
      primaryValues: [5],
    });
    expect(evaluateChoiceHoldemHand(cards(5, 5, 2), cards(5, 3)).category).toBe('triple');
    expect(evaluateChoiceHoldemHand(cards(5, 5, 2), cards(2, 3)).category).toBe('two-pair');
    expect(evaluateChoiceHoldemHand(cards(5, 5, 2), cards(1, 3)).category).toBe('one-pair');
  });

  it('같은 조합이면 조합 숫자를 먼저 비교한다', () => {
    const highTriple = evaluateChoiceHoldemHand(cards(4, 4, 1), cards(4, 2));
    const lowTriple = evaluateChoiceHoldemHand(cards(3, 3, 5), cards(3, 2));
    expect(compareChoiceHoldemEvaluations(highTriple, lowTriple)).toBe(1);
  });

  it('조합 숫자까지 같으면 조합에 포함되지 않은 개인 카드를 비교한다', () => {
    const lowPrivate = evaluateChoiceHoldemHand(cards(2, 2, 5), cards(4, 1));
    const highPrivate = evaluateChoiceHoldemHand(cards(2, 2, 5), cards(4, 3));
    expect(lowPrivate.privateKickers).toEqual([4, 1]);
    expect(highPrivate.privateKickers).toEqual([4, 3]);
    expect(compareChoiceHoldemEvaluations(lowPrivate, highPrivate)).toBe(-1);
  });

  it('족보·조합 숫자·개인 비교 카드가 모두 같으면 완전 동률이다', () => {
    const first = evaluateChoiceHoldemHand(cards(1, 2, 3), cards(4, 5));
    const second = evaluateChoiceHoldemHand(cards(1, 2, 3), cards(4, 5));
    expect(compareChoiceHoldemEvaluations(first, second)).toBe(0);
  });
});
