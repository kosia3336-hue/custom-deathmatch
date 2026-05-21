/**
 * 인디언홀덤 (이벤트) — 40장 덱.
 * 매 핸드마다 셔플 후 사용 (랭크 이벤트와 다르게 카드 누적 X).
 */

const TOTAL_CARDS = 40;
const NUMBERS = 10;
const COPIES_PER_NUMBER = 4;

export function createShuffledDeck(): number[] {
  const deck: number[] = new Array(TOTAL_CARDS);
  let idx = 0;
  for (let num = 1; num <= NUMBERS; num++) {
    for (let c = 0; c < COPIES_PER_NUMBER; c++) {
      deck[idx++] = num;
    }
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
