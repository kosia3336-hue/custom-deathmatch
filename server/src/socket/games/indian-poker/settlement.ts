import type { InternalState, IPPlayerInternal } from './types.js';
import { evaluateHand, judgeShowdown, getDiePenalty } from './judge.js';

function getOpponent(s: InternalState, id: string): IPPlayerInternal {
  return s.players[id === s.player1Id ? s.player2Id : s.player1Id];
}

export function settleShowdown(s: InternalState) {
  const p1 = s.players[s.player1Id];
  const p2 = s.players[s.player2Id];

  const hand1 = evaluateHand(p1.card!, s.communityCards!);
  const hand2 = evaluateHand(p2.card!, s.communityCards!);

  const result = judgeShowdown(
    { id: p1.id, card: p1.card!, hand: hand1 },
    { id: p2.id, card: p2.card!, hand: hand2 },
  );

  if (result.isDraw) {
    const half = Math.floor(s.pot / 2);
    const remainder = s.pot - half * 2;
    p1.chips += half;
    p2.chips += half;
    if (remainder > 0) {
      s.players[s.firstBettorId].chips += remainder;
    }

    s.showdownData = {
      players: {
        [p1.id]: {
          card: p1.card!,
          hand: hand1,
          chipChange:
            half + (s.firstBettorId === p1.id ? remainder : 0) - (s.roundAnte + p1.roundBet),
        },
        [p2.id]: {
          card: p2.card!,
          hand: hand2,
          chipChange:
            half + (s.firstBettorId === p2.id ? remainder : 0) - (s.roundAnte + p2.roundBet),
        },
      },
      winnerId: null,
      isDraw: true,
    };
  } else {
    const winnerId = result.winnerId!;
    s.players[winnerId].chips += s.pot;

    s.showdownData = {
      players: {
        [p1.id]: {
          card: p1.card!,
          hand: hand1,
          chipChange:
            p1.id === winnerId ? s.pot - (s.roundAnte + p1.roundBet) : -(s.roundAnte + p1.roundBet),
        },
        [p2.id]: {
          card: p2.card!,
          hand: hand2,
          chipChange:
            p2.id === winnerId ? s.pot - (s.roundAnte + p2.roundBet) : -(s.roundAnte + p2.roundBet),
        },
      },
      winnerId,
      isDraw: false,
    };
  }

  saveRoundRecord(s, result, hand1, hand2);
}

export function settleDie(s: InternalState, diedPlayerId: string) {
  const diedPlayer = s.players[diedPlayerId];
  const opponent = getOpponent(s, diedPlayerId);

  const diedHand = evaluateHand(diedPlayer.card!, s.communityCards!);
  let penalty = getDiePenalty(diedHand);
  penalty = Math.min(penalty, diedPlayer.chips);

  opponent.chips += s.pot + penalty;
  diedPlayer.chips -= penalty;

  s.dieData = {
    diedPlayerId,
    diedCard: diedPlayer.card!,
    diedHand,
    penalty,
    potAmount: s.pot,
    chipChanges: {
      [diedPlayerId]: -(s.roundAnte + diedPlayer.roundBet + penalty),
      [opponent.id]: s.pot + penalty - (s.roundAnte + opponent.roundBet),
    },
  };

  const opponentHand = evaluateHand(opponent.card!, s.communityCards!);
  saveRoundRecord(
    s,
    { winnerId: opponent.id, isDraw: false },
    diedPlayerId === s.player1Id ? diedHand : opponentHand,
    diedPlayerId === s.player2Id ? diedHand : opponentHand,
    true,
  );
}

function saveRoundRecord(
  s: InternalState,
  result: { winnerId: string | null; isDraw: boolean },
  hand1: import('@shared/types/indian-poker.js').IPHand,
  hand2: import('@shared/types/indian-poker.js').IPHand,
  isDie = false,
) {
  s.roundHistory.push({
    round: s.round,
    communityCards: [...s.communityCards!] as [number, number],
    playerCards: {
      [s.player1Id]: s.players[s.player1Id].card!,
      [s.player2Id]: s.players[s.player2Id].card!,
    },
    winnerId: result.winnerId,
    isDraw: result.isDraw,
    isDie,
    chipChanges: {
      [s.player1Id]:
        s.showdownData?.players[s.player1Id]?.chipChange ??
        s.dieData?.chipChanges[s.player1Id] ??
        0,
      [s.player2Id]:
        s.showdownData?.players[s.player2Id]?.chipChange ??
        s.dieData?.chipChanges[s.player2Id] ??
        0,
    },
    bettingActions: [...s.currentRoundActions],
    hands: {
      [s.player1Id]: hand1,
      [s.player2Id]: hand2,
    },
  });
}
