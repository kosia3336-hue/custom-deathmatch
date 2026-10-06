import type { InternalState, IPPlayerInternal, IPUndoSnapshot } from './types.js';

function snapshotPlayer(p: IPPlayerInternal): IPUndoSnapshot['player1'] {
  return { chips: p.chips, roundBet: p.roundBet, card: p.card };
}

function restorePlayer(p: IPPlayerInternal, snap: IPUndoSnapshot['player1']) {
  p.chips = snap.chips;
  p.roundBet = snap.roundBet;
  p.card = snap.card;
}

export function createSnapshot(s: InternalState): IPUndoSnapshot {
  return {
    round: s.round,
    phase: s.phase,
    deck: [...s.deck],
    communityCards: s.communityCards ? ([...s.communityCards] as [number, number]) : null,
    player1: snapshotPlayer(s.players[s.player1Id]),
    player2: snapshotPlayer(s.players[s.player2Id]),
    pot: s.pot,
    currentTurnId: s.currentTurnId,
    currentBet: s.currentBet,
    ante: s.ante,
    roundAnte: s.roundAnte,
    deckCycle: s.deckCycle,
    firstBettorId: s.firstBettorId,
    bettingStarted: s.bettingStarted,
    currentRoundActions: JSON.parse(JSON.stringify(s.currentRoundActions)),
    roundHistory: JSON.parse(JSON.stringify(s.roundHistory)),
    usedCards: [...s.usedCards],
    totalBettingActions: s.totalBettingActions,
  };
}

export function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push(createSnapshot(s));
}

export function applySnapshot(s: InternalState, snap: IPUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.deck = [...snap.deck];
  s.communityCards = snap.communityCards ? ([...snap.communityCards] as [number, number]) : null;
  restorePlayer(s.players[s.player1Id], snap.player1);
  restorePlayer(s.players[s.player2Id], snap.player2);
  s.pot = snap.pot;
  s.currentTurnId = snap.currentTurnId;
  s.currentBet = snap.currentBet;
  s.ante = snap.ante;
  s.roundAnte = snap.roundAnte;
  s.deckCycle = snap.deckCycle;
  s.firstBettorId = snap.firstBettorId;
  s.bettingStarted = snap.bettingStarted;
  s.currentRoundActions = JSON.parse(JSON.stringify(snap.currentRoundActions));
  s.roundHistory = JSON.parse(JSON.stringify(snap.roundHistory));
  s.usedCards = [...snap.usedCards];
  s.totalBettingActions = snap.totalBettingActions;
  s.showdownData = null;
  s.dieData = null;
}
