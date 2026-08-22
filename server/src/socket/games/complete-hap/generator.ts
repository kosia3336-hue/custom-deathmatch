import { CH_CARDS_PER_BOARD, type CompleteHapCard } from '@shared/types/complete-hap.js';

const SHAPES = ['circle', 'triangle', 'square'] as const;
const BACKGROUNDS = ['black', 'gray', 'white'] as const;
const COLORS = ['red', 'yellow', 'blue'] as const;

export function createCompleteHapDeck(): CompleteHapCard[] {
  return SHAPES.flatMap((shape) =>
    BACKGROUNDS.flatMap((background) => COLORS.map((color) => ({ shape, background, color }))),
  );
}

export function isCompleteHapSet(cards: CompleteHapCard[]): boolean {
  if (cards.length !== 3) return false;
  return (['shape', 'background', 'color'] as const).every((attribute) => {
    const valueCount = new Set(cards.map((card) => card[attribute])).size;
    return valueCount === 1 || valueCount === 3;
  });
}

export function findCompleteHapSets(cards: CompleteHapCard[]): number[][] {
  const sets: number[][] = [];
  for (let first = 0; first < cards.length - 2; first++) {
    for (let second = first + 1; second < cards.length - 1; second++) {
      for (let third = second + 1; third < cards.length; third++) {
        if (isCompleteHapSet([cards[first], cards[second], cards[third]])) {
          sets.push([first, second, third]);
        }
      }
    }
  }
  return sets;
}

export function completeHapSetKey(indexes: number[]): string {
  return [...indexes].sort((a, b) => a - b).join('-');
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const picked = Math.floor(random() * (index + 1));
    [result[index], result[picked]] = [result[picked], result[index]];
  }
  return result;
}

function buildBoard(cards: CompleteHapCard[]) {
  const allSets = findCompleteHapSets(cards);
  return {
    cards,
    allSets,
    allSetKeys: new Set(allSets.map(completeHapSetKey)),
  };
}

/** 9장짜리 문제 하나를 만들며, 모든 합을 찾는 게임이 성립하도록 합을 2개 이상 보장한다. */
export function dealCompleteHapBoard(random: () => number = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const board = buildBoard(shuffle(createCompleteHapDeck(), random).slice(0, CH_CARDS_PER_BOARD));
    if (board.allSets.length >= 2) return board;
  }
  // 주입된 난수가 항상 같은 값을 내는 테스트 환경에서도 유효한 문제를 반환한다.
  return buildBoard(createCompleteHapDeck().slice(0, CH_CARDS_PER_BOARD));
}

export function dealCompleteHapRounds(count: number, random: () => number = Math.random) {
  return Array.from({ length: count }, () => dealCompleteHapBoard(random));
}
