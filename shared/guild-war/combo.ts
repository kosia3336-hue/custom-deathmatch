import type { ColorId, RtbCard } from './types';
import { COLORS } from './types';

export function colorsForCount(n: number): ColorId[] {
  if (n <= 5) return COLORS.slice(0, 4);
  if (n <= 7) return COLORS.slice(0, 5);
  return [...COLORS];
}

export function buildDeck(playerCount: number): RtbCard[] {
  const colors = colorsForCount(playerCount);
  const deck: RtbCard[] = [];
  for (const color of colors) {
    for (let rank = 1; rank <= 10; rank++) {
      deck.push({ id: `${color}-${rank}`, color, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

export function isValidCombo(cards: RtbCard[]): boolean {
  if (cards.length < 1 || cards.length > 4) return false;
  const ids = new Set(cards.map((c) => c.id));
  if (ids.size !== cards.length) return false;
  const ranks = new Set(cards.map((c) => c.rank));
  const colors = new Set(cards.map((c) => c.color));
  return ranks.size === 1 || colors.size === 1;
}

export function comboScore(cards: RtbCard[]): number {
  return cards.reduce((sum, c) => sum + c.rank, 0);
}

export function bestCombo(hand: RtbCard[]): RtbCard[] {
  if (hand.length === 0) return [];
  let best = [hand[0]!];
  let bestScore = hand[0]!.rank;
  const n = hand.length;
  const limit = 1 << n;
  for (let mask = 1; mask < limit; mask++) {
    const pick = hand.filter((_, i) => (mask & (1 << i)) !== 0);
    if (!isValidCombo(pick)) continue;
    const score = comboScore(pick);
    if (score > bestScore || (score === bestScore && pick.length > best.length)) {
      best = pick;
      bestScore = score;
    }
  }
  return best;
}

export function isFourOfAKind(hand: RtbCard[]): boolean {
  return hand.length === 4 && hand.every((c) => c.rank === hand[0]!.rank);
}

export function requiredBellRank(aliveCount: number): number {
  return Math.floor(aliveCount / 2);
}

export function bestScoreAfterTaking(hand: RtbCard[], taken: RtbCard): { discardId: string; score: number } {
  let discardId = hand[0]?.id ?? taken.id;
  let score = 0;
  const five = [...hand, taken];
  for (const card of five) {
    const remain = five.filter((c) => c.id !== card.id);
    if (remain.length !== 4) continue;
    const s = comboScore(bestCombo(remain));
    if (s > score) {
      score = s;
      discardId = card.id;
    }
  }
  return { discardId, score };
}

export function assignRanks(
  rows: { id: string; score: number }[],
  bellId: string | null,
): Record<string, number> {
  const sorted = [...rows].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.id === bellId) return -1;
    if (b.id === bellId) return 1;
    return 0;
  });
  const ranks: Record<string, number> = {};
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev && aTied(prev, row, bellId)) {
      ranks[row.id] = ranks[prev.id]!;
    } else {
      ranks[row.id] = i + 1;
    }
  }
  return ranks;
}

function aTied(
  a: { id: string; score: number },
  b: { id: string; score: number },
  bellId: string | null,
): boolean {
  if (a.score !== b.score) return false;
  if (a.id === bellId || b.id === bellId) return false;
  return true;
}
