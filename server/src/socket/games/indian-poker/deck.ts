import type { InternalState } from './types.js';

export function createDeck(): number[] {
  const deck: number[] = [];
  for (let num = 1; num <= 10; num++) {
    for (let i = 0; i < 4; i++) {
      deck.push(num);
    }
  }
  return deck;
}

export function shuffle(deck: number[]): number[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function deal(state: InternalState): void {
  shuffle(state.deck);
  const c1 = state.deck.pop()!;
  const c2 = state.deck.pop()!;
  state.communityCards = [c1, c2];

  const p1Card = state.deck.pop()!;
  const p2Card = state.deck.pop()!;
  state.players[state.player1Id].card = p1Card;
  state.players[state.player2Id].card = p2Card;

  state.usedCards.push(c1, c2, p1Card, p2Card);
}

export function checkDeckReset(state: InternalState): boolean {
  if (state.deck.length <= 4) {
    state.deck = createDeck();
    state.usedCards = [];
    state.ante += 1;
    state.deckCycle += 1;
    return true;
  }
  return false;
}

export function getRemainingCards(
  usedCards: number[],
  communityCards: [number, number],
  knownCard: number,
): number[] {
  const excluded = [...usedCards];
  const result: number[] = [];
  const fullDeck = createDeck();

  const excludeCounts = new Map<number, number>();
  for (const c of excluded) {
    excludeCounts.set(c, (excludeCounts.get(c) ?? 0) + 1);
  }
  // Also exclude community cards and known card from this round
  for (const c of communityCards) {
    excludeCounts.set(c, (excludeCounts.get(c) ?? 0) + 1);
  }
  excludeCounts.set(knownCard, (excludeCounts.get(knownCard) ?? 0) + 1);

  const deckCounts = new Map<number, number>();
  for (const c of fullDeck) {
    deckCounts.set(c, (deckCounts.get(c) ?? 0) + 1);
  }

  for (const [num, total] of deckCounts) {
    const used = excludeCounts.get(num) ?? 0;
    const remaining = total - used;
    for (let i = 0; i < remaining; i++) {
      result.push(num);
    }
  }

  return result;
}
