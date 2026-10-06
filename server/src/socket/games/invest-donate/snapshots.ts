import type { InternalState, IDPlayerInternal, IDUndoSnapshot, IDPlayerSnapshot } from './types.js';

function snapshotPlayer(p: IDPlayerInternal): IDPlayerSnapshot {
  return {
    score: p.score,
    coinStock: { ...p.coinStock },
    submitted: p.submitted,
    investCoins: p.investCoins ? { ...p.investCoins } : null,
    donateCoins: p.donateCoins ? { ...p.donateCoins } : null,
    investBadge: p.investBadge,
    donateBadge: p.donateBadge,
  };
}

function restorePlayer(p: IDPlayerInternal, snap: IDPlayerSnapshot) {
  p.score = snap.score;
  p.coinStock = { ...snap.coinStock };
  p.submitted = snap.submitted;
  p.investCoins = snap.investCoins ? { ...snap.investCoins } : null;
  p.donateCoins = snap.donateCoins ? { ...snap.donateCoins } : null;
  p.investBadge = snap.investBadge;
  p.donateBadge = snap.donateBadge;
}

export function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    roundHistory: structuredClone(s.roundHistory),
    actionLog: structuredClone(s.actionLog),
  });
}

export function applyUndoSnapshot(s: InternalState, snap: IDUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.roundHistory = structuredClone(snap.roundHistory);
  s.actionLog = structuredClone(snap.actionLog);
}
