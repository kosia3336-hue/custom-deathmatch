import type {
  InternalState,
  BRPSPlayerInternal,
  BRPSPlayerSnapshot,
  BRPSUndoSnapshot,
} from './types.js';

function snapshotPlayer(p: BRPSPlayerInternal): BRPSPlayerSnapshot {
  return {
    chips: p.chips,
    role: p.role,
    hasChoiceRight: p.hasChoiceRight,
    submitted: p.submitted,
    matchResult: p.matchResult,
    prediction: p.prediction,
    betChips: p.betChips,
  };
}

function restorePlayer(p: BRPSPlayerInternal, snap: BRPSPlayerSnapshot) {
  p.chips = snap.chips;
  p.role = snap.role;
  p.hasChoiceRight = snap.hasChoiceRight;
  p.submitted = snap.submitted;
  p.matchResult = snap.matchResult;
  p.prediction = snap.prediction;
  p.betChips = snap.betChips;
}

export function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    actionLog: structuredClone(s.actionLog),
  });
}

export function applyBRPSUndoSnapshot(s: InternalState, snap: BRPSUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.actionLog = structuredClone(snap.actionLog);
}
